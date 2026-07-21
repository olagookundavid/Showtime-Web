# Contabo Infrastructure Operations Manual

**Scope:** the self-hosted Contabo VPS that runs the Showtime backend, its
Postgres database, and the reverse proxy in front of both. This document
covers infrastructure only — not application code, API design, or business
logic, except where those directly drove an infrastructure decision.

**Audience:** an engineer (human or AI agent) who needs to operate, maintain,
extend, or recreate this infrastructure with no other context than this file
and the repo.

> **No secrets in this document.** Real credentials live in `.env` files on
> the server (`chmod 600`) and in provider dashboards (Cloudflare, GitHub,
> Resend, Paystack). Every value shown here is a placeholder or a path, never
> a live secret. This document is safe to keep in a public repository.

---

## 1. Overview

### 1.1 What was built, and why

The backend previously ran on Koyeb (PaaS) with a Neon-managed Postgres
database. That setup worked but had two costs: recurring platform fees that
scale with usage, and limited control over the database (tuning, backup
strategy, network topology). The goal was to migrate to a single Contabo VPS
that is:

- **Security-tight** — hardened SSH, minimal attack surface, least-privilege
  database access, no unnecessary public exposure.
- **Self-sufficient** — self-hosted Postgres with real backups, not a
  managed-service dependency.
- **Automatable** — a `git push` should result in a live deployment with no
  manual server work.
- **Observable** — failures (backup, disk, uptime) should page a human, not
  wait to be noticed.
- **Extensible** — built so a second and third application can be hosted on
  the same box without re-architecting.

### 1.2 High-level architecture

```
                              Internet
                                 |
                        +--------v---------+
                        |  Cloudflare edge  |  Proxied (orange cloud).
                        |    (proxied)      |  Public TLS cert, DDoS/WAF
                        +--------+----------+  absorption, hides origin IP.
                                 |
                    only Cloudflare's published IP
                    ranges may reach the origin's
                    80/443 (enforced in DOCKER-USER,
                    see §3.4)
                                 |
                        +--------v---------+
                        |      Caddy       |  TLS to Cloudflare via an
                        |  (only public    |  Origin Certificate. Routes
                        |   container)     |  by hostname. Blocks common
                        +--------+---------+  scanner paths before they
                                 |             reach the app.
                     docker network: web
                                 |
                        +--------v---------+
                        | showtime-backend |  Go API, listens :8080
                        +--------+---------+  internally. No public port.
                                 |
                   docker network: database
                                 |
                        +--------v---------+
                        |    postgres:18   |  Not exposed to the internet.
                        |  (volume pgdata) |  127.0.0.1-only port for
                        +------------------+  SSH-tunneled GUI access.
```

**Two TLS hops, two different certificates** — the detail that trips people
up most. The browser validates a normal, publicly-trusted certificate against
**Cloudflare's edge** (hop 1; Cloudflare manages this automatically, no
action needed). Cloudflare then validates a **Cloudflare Origin Certificate**
against **Caddy** (hop 2; SSL mode `Full (strict)`). The Origin Certificate is
valid until 2041 and is deliberately trusted only by Cloudflare — a direct
`curl` or browser hit to the origin correctly shows an untrusted-certificate
error. That is by design, not a bug.

### 1.3 Key design decisions at a glance

| Decision | Choice made | Primary reason |
|---|---|---|
| Container platform | Docker + Compose (not Kubernetes) | Single VPS, single operator — Compose's simplicity matches the scale; k8s overhead isn't justified at this size. |
| Database hosting | Self-hosted Postgres in a container, not a managed service | Cost, control over tuning/backups, and it was the explicit goal of the migration. |
| Multi-tenancy model | One shared Postgres instance, one database + one least-privilege user per app | RAM/ops efficiency for a small VPS; the trade-off (shared blast radius, shared maintenance window) is acceptable at this scale. See §2, Phase 7. |
| Reverse proxy | Caddy, not Nginx/Traefik | Automatic HTTPS, minimal config, best learning curve for a single operator. |
| CI/CD | GitHub Actions → `ghcr.io` → SSH-triggered pull on the server | Free (public repo = unlimited Actions minutes), no build load on the production box, native `amd64` build matches the server (avoids cross-arch issues from an Apple Silicon dev machine). |
| Secrets | Provider dashboards + server `.env` files, never in the image or git | Standard practice; keeps the image safe to be public. |
| TLS | Caddy automatic Let's Encrypt initially, then a Cloudflare Origin Certificate once proxied | HTTP-01 challenges don't play well with a proxied domain; the Origin Cert avoids needing a custom Caddy build with a DNS-01 plugin. |
| Origin protection | Cloudflare proxy + `DOCKER-USER` iptables allow-list of Cloudflare's ranges | UFW alone does not enforce this for Docker-published ports (see §7, "Docker bypasses UFW"). |
| Backups | `pg_dump` nightly, offsite to a *separate*, bucket-scoped Cloudflare R2 bucket | Isolates backup credentials from the app's own storage credentials — an app compromise cannot also destroy backup history. |
| Monitoring | External uptime monitor + server-side alert scripts emailing via Resend | A monitor **on** the server is useless the moment the server is the thing that's down. |

---

## 2. Infrastructure Journey

This section documents the major phases in the order they actually happened,
including the decisions that were reconsidered mid-stream and why.

### Phase 0 — Prerequisites

An SSH key pair was generated on the operator's machine (`ed25519`, with
passphrase) before touching the server at all. Rule of thumb followed
throughout this build: **lock down access before installing anything**, not
after.

### Phase 1 — First login, base OS update

Logged in as `root` (the only way in on a fresh VPS), ran `apt update && apt
upgrade`, set the timezone to UTC for consistent log timestamps.

### Phase 2 — Non-root user

Created a personal sudo-capable user and installed the SSH public key for
that user via `ssh-copy-id`, verified login and `sudo` access **before**
closing the root session (a safety net in case the new user's access was
broken).

### Phase 3 — SSH hardening, and a real gotcha

Set `PermitRootLogin no` and `PasswordAuthentication no` in the main sshd
config, restarted `sshd`, and moved on.

**What went wrong:** password authentication kept working anyway. The cause:
Ubuntu cloud images load additional config from `/etc/ssh/sshd_config.d/*` in
**alphabetical order**, and for any given directive, **the first value sshd
reads wins** — not the last, and not the "most specific" file. A pre-existing
`50-cloud-init.conf` set `PasswordAuthentication yes`, and it was read before
the fix, silently overriding it.

**The fix, and the pattern worth remembering:** rather than edit
`50-cloud-init.conf` directly (cloud-init can regenerate it on reboot), a new
file was added that sorts before it — `00-hardening.conf` — so its values win
by load order. This is the general pattern for any drop-in config directory
that resolves "first match wins": don't fight the existing file, out-sort it.

### Phase 4 — Firewall (UFW)

Default-deny inbound, explicit allow for SSH only at this stage. Ports
80/443 were added later, only once something needed to serve them.

**Key caveat learned here (and re-encountered later, more sharply, in Phase
14):** Docker writes its own iptables rules for any port a container
publishes, and those rules are evaluated **ahead of** UFW's chain. A
published Docker port can be reachable even when UFW's status output claims
it's blocked. UFW is necessary but, for Docker-published ports specifically,
not sufficient on its own — see Phase 14 for the real fix.

### Phase 5 — fail2ban, unattended-upgrades, swap

`fail2ban` was installed for SSH brute-force protection (defaults were
sufficient — bans triggered on real scanner traffic within minutes of the
server going live). `unattended-upgrades` was installed for automatic
security patches, but **automatic reboot was deliberately left off** — for a
database host, an unattended reboot is a moment you want to be watching, not
sleeping through.

A resource check (`free -h`, `df -h`, `nproc`) revealed **zero swap
configured**. On a box that would run a database plus several app
containers, this was flagged as a real risk: if memory pressure ever spikes,
Linux's OOM killer can silently and instantly kill a process — often
Postgres, since it tends to be the largest memory consumer — with no warning
and a real risk of corrupting in-flight writes. A 2 GB swap file was added
with `vm.swappiness=10`: present as an emergency valve, but tuned so the
kernel avoids using it for routine caching (a database that's *actually*
swapping under normal load is a database crawling at disk speed, not RAM
speed).

### Phase 6 — Docker Engine

Installed from Docker's official `apt` repository (not the older, slower-to-
patch distro package `docker.io`). The installing user was added to the
`docker` group so Docker could be run without `sudo` — with the explicit
understanding that group membership is root-equivalent (any container can
mount the host filesystem), so it's only appropriate for a trusted admin
account, never handed out casually.

### Phase 7 — Self-hosted Postgres

Two decisions were made deliberately here, both revisited from a first
instinct:

**Decision A — one shared Postgres instance, not one per app.** Considered
because this box was always intended to host more than one project. A
comparison was made:

| | Shared instance (chosen) | One instance per app |
|---|---|---|
| RAM | One instance's overhead — efficient on a modest VPS | Each instance adds baseline overhead |
| Backups | One routine covers everything | N separate routines |
| Upgrades | One upgrade event, but all apps share the maintenance window | Independent, but more moving parts |
| Blast radius | A runaway query or compromise in one app's DB can affect Postgres-wide resources | Fully isolated |

Shared won for a personal VPS of this scale, with isolation achieved instead
at the **database + user** level: each app gets its own database and a
least-privileged user scoped to only that database, never the superuser.

**Decision B — Postgres major version.** The first instinct was version 16
("boring and battle-tested" — appropriate caution for *migrating* an existing
production database). But this was a **brand-new** database with zero
existing data, so that caution didn't actually apply — version 18 had been
stable for months. The version was corrected to 18 before any data existed,
avoiding a pointless later upgrade.

**The version-pinning rule that came out of this:** never use `postgres:latest`.
Major version bumps change the on-disk data format and Postgres will refuse
to start against an old-format data directory — an accidental jump from an
unpinned tag is a classic way to wake up to a dead database. The fix is to
pin the **major** version only (`postgres:18`), which still receives all
minor/patch security updates automatically on every re-pull, but never
silently jumps to 19.

**Networking model established here, used for everything after:** a
Postgres container is created with **no published port at all** — it exists
only on a private, user-defined Docker network (`database`), created
independently of any single Compose file (`docker network create database`)
so multiple, separate Compose projects can all join it. Containers on the
same Docker network resolve each other by container name via Docker's
built-in DNS (the backend connects to host `postgres`, never an IP). Nothing
outside that network — including the internet, and even the host machine
itself unless explicitly published — can reach the database. This is a
structural guarantee, not a firewall rule that can be misconfigured away.

Memory was tuned deliberately **below** the classic "25% of RAM" rule a
dedicated database server would use, because this box is shared with other
containers: `shared_buffers=2GB`, `effective_cache_size=6GB`, `work_mem=32MB`
(kept modest because it multiplies per sort operation, per connection — a
global bump here is a common way to accidentally exhaust memory),
`maintenance_work_mem=256MB`, `max_connections=100`.

A dedicated `showtime` database and `showtime` user were created (not the
`postgres` superuser), with the `public` schema's default privileges
tightened — Postgres historically leaves `public` writable by all users,
which was explicitly revoked and re-granted only to the app's own user.

**Later addition (once GUI DB access was needed):** Postgres was given a
port publish of **`127.0.0.1:5432:5432`** — loopback only, never `0.0.0.0`.
This makes it reachable from the host machine itself (and thus via an SSH
tunnel) but still completely unreachable from the internet. Beekeeper Studio
connects through an SSH tunnel to `127.0.0.1:5432`, authenticating as the
least-privileged `showtime` user, never the superuser.

### Phase 8 — CI: build and publish the backend image

A GitHub Actions workflow was added to build the backend's existing
multi-stage Dockerfile and push the image to GitHub Container Registry
(`ghcr.io`), tagged both `:latest` and `:sha-<commit>` (the latter being the
rollback lifeline — an immutable tag pinned to an exact commit). The build
targets `linux/amd64` explicitly, because the operator's development machine
is Apple Silicon (`arm64`) and the server is `amd64` — building on GitHub's
native `amd64` runners sidesteps any cross-architecture build issues
entirely.

**A visibility decision, revisited:** the ghcr package was initially set up
with an instinct toward "private, for security." That instinct was corrected
once it was noticed the **source repository itself is public** — the
Dockerfile, routes, and full application logic are already visible to
anyone. Making the compiled image private added friction (a registry auth
token the server would need) for no actual security benefit, since nothing
secret lives in the image (secrets are injected at runtime via `.env`, never
baked in). The package was made public. This is worth re-evaluating if the
source repository ever becomes private.

**A pre-existing, unrelated CI issue was found and fixed along the way:**
this project's separate, pre-existing `ci.yml` (test/build validation,
unrelated to the deploy pipeline) was failing, because the backend's Swagger
documentation package is code-generated (via `swag init`) and deliberately
gitignored — CI was running `go build` without generating it first. The fix
mirrored what the Dockerfile already did correctly: install `swag` and run
`swag init` before the build step.

**A misconception corrected here, worth stating plainly:** there was a
concern about "wasting free CI/CD minutes." GitHub Actions is **free and
unlimited for public repositories** — there is no minutes budget to protect,
so no reason to disable or minimize CI runs on a public repo.

### Phase 9 — Deploying the backend, and the first real outage-in-waiting

The backend's Compose file was written to join the `database` network (to
reach Postgres) and to load all configuration from a server-side `.env` file.
Rather than guess at required environment variables, the entire codebase was
grepped for every `os.Getenv` / config-loading call, producing an
authoritative list rather than a remembered one (see §4, Configuration
Reference, for the full table). Two real issues surfaced from this audit,
not from documentation:

1. **`CORS_ALLOW_ORIGINS`** — the backend's CORS logic (in the shared
   `pkg-common/helpers` package) allows explicitly listed origins, but if
   running in production **without** an explicit allow-list, it silently
   falls back to trusting *any* `*.vercel.app` origin — and the API sets
   `AllowCredentials: true`. Combined, an unset allow-list in production is a
   real vulnerability: any attacker who deploys a throwaway Vercel site could
   make credentialed cross-origin requests using a logged-in user's cookies.
   Setting an explicit `CORS_ALLOW_ORIGINS` closes this wildcard entirely.
2. **`FRONTEND_URL`** — unset on the previous platform, it was silently
   falling back to `http://localhost:5173` inside referral emails sent to
   real users. Not a security issue, but a real, previously-unnoticed bug
   that this migration's environment audit caught and fixed.

**Two decisions were made to explicitly *not* set certain variables, matching
prior working behavior rather than guessing at "more correct" values:**
`COOKIE_DOMAIN` and `API_HOST` were both left unset. `COOKIE_DOMAIN` unset
produces a host-only auth cookie scoped to the API's own hostname — exactly
what a single-domain API needs, and changing it was correctly recognized as
unnecessary risk with no benefit. `API_HOST` only affects a cosmetic Swagger
label and is irrelevant in production (Swagger is disabled).

**Two setup mistakes were made and fixed on the first real deploy attempt:**

- The database password, generated with `openssl rand -base64 24`, contained
  `/` characters. Because the password lives inside a `postgres://` **URL**,
  and `/` is a URL structural character, the connection string parser
  misread it and the backend failed to connect with a confusing error. The
  fix, and the rule going forward: **any password embedded in a URL should
  be generated with `openssl rand -hex`**, which is always URL-safe.
- The first migration run failed with `function uuid_generate_v4() does not
  exist`. Two of the project's ~19 migrations used `uuid_generate_v4()`,
  which requires the `uuid-ossp` Postgres extension — pre-installed on the
  previous managed provider (Neon/Koyeb's underlying host), but **not**
  present on a vanilla, self-hosted Postgres image. A full sweep of every
  migration file confirmed this was the *only* extension dependency in the
  entire schema (no `citext`, no `pg_trgm`, no PostGIS, nothing else). Rather
  than just enabling the extension as a one-off server fix, the two
  offending migrations were changed at the source to use Postgres's built-in
  `gen_random_uuid()` instead — matching the other 17 migrations, and making
  every future fresh database installation extension-free by construction,
  not by a manual step someone has to remember.

Once both were fixed, all 39 migrations applied cleanly on the first true
attempt and the backend began serving traffic against a real (if still
empty) schema.

### Phase 10 — Data migration from the previous production database (Neon)

The live production data was migrated from Neon (Postgres-as-a-service) to
the new self-hosted instance using `pg_dump`/`pg_restore`, not a from-scratch
re-seed.

**Two Neon-specific details mattered:** Neon exposes both a pooled
(`-pooler` in the hostname) and a direct connection string; `pg_dump`
requires the **direct** one, since dumping through a transaction-mode
connection pooler is unreliable. And the dump was taken with
`--no-owner --no-privileges`, stripping Neon's own role/ownership metadata so
that, on restore, every object could be re-owned cleanly by the local
`showtime` user rather than failing on "role does not exist" errors from a
role that only ever existed on Neon.

The cutover procedure: stop the backend, drop and recreate an empty
`showtime` database, restore the dump as the `showtime` user, re-confirm the
`uuid-ossp` extension exists (the *restored* dump still reflects whatever
schema state Neon had — including any legacy `uuid_generate_v4()` column
defaults from before the migration-file fix in Phase 9 — so the extension
was kept available defensively), then restart the backend. Verification was
done first against public, unauthenticated API routes with real content
(hero slides, news, season graphics) before touching the frontend at all, and
a **second, fresher dump/restore pass was done immediately before the actual
frontend cutover**, to minimize the window of data written to Neon after the
rehearsal dump.

### Phase 11 — Reverse proxy and HTTPS (Caddy, first pass)

Caddy was introduced as the only publicly-exposed container, on a new
`web` Docker network. Its `Caddyfile` was, at first, a single reverse-proxy
block, and it obtained a real Let's Encrypt certificate automatically via
the HTTP-01 challenge — which requires the domain's DNS to resolve directly
to the server (Cloudflare's DNS record was set to **DNS-only / grey cloud**
specifically to make this simple, deferring the proxied/orange setup to a
later, deliberate phase). Ports 80/443 were opened in UFW at this point,
having had no reason to be open before. The Caddy TLS data volume
(`caddy_data`) was flagged early as something that **must** persist across
container recreations — it holds the issued certificate and the ACME
account key, and losing it means needlessly re-requesting a certificate
against Let's Encrypt's rate limits.

### Phase 12 — Automating deployment

A dedicated, **restricted** SSH key was created solely for CI to use, with a
forced command in the server's `authorized_keys` (the
`command="...",no-port-forwarding,no-agent-forwarding,no-pty` pattern) — this
key can execute *only* the deploy sequence and nothing else, even if the
private key were somehow exposed. The deploy logic itself was, at first,
inlined directly into that `authorized_keys` line — functional but opaque —
and was refactored into a proper `~/scripts/deploy.sh` on the server (with
output tee'd to a persistent `~/deploy.log`), with the forced command
reduced to simply invoking that script. A reference copy was also committed
into the repository at `scripts/deploy.sh`, with an explicit note that the
two copies are **not** auto-synced — the server never checks out the repo,
by design, so a change to deploy logic must be applied in both places by
hand.

A `deploy` job was added to the CI workflow with `needs: build-and-push`, so
a failed image build never triggers a deployment attempt. The now-obsolete
`keep-alive.yml` workflow — which existed solely to prevent the previous
PaaS platform's free tier from cold-starting the service — was removed once
the self-hosted backend (`restart: unless-stopped`, no scale-to-zero) made
it meaningless.

### Phase 13 — Backups

Cloudflare R2 was chosen for offsite backup storage over Google Drive or
OneDrive, specifically because R2's S3-compatible API scripts cleanly with
`rclone` on a headless server, whereas Drive/OneDrive rely on OAuth flows
that are awkward to automate unattended and can silently expire.

A security principle was applied deliberately here: the backup bucket uses
its **own**, separate API token, scoped only to that one bucket — never
reusing the application's own R2 credentials. The reasoning: if the
application server is ever compromised, an attacker who finds the app's R2
key should not also be able to reach or delete the backup history. Backup
credentials that an app-level compromise can also use to delete backups
aren't meaningfully protecting against the most likely real disaster
(ransomware, or a compromised deploy key).

**A confusing-but-correct rclone behavior was hit and clarified:**
`rclone lsd <remote>:` (listing *all* buckets) returned `403 AccessDenied`
even though the token was valid. This is expected: a bucket-scoped token
cannot perform account-level operations like `ListBuckets` — that's the
token correctly enforcing its own narrow scope. The working, scope-respecting
check is `rclone ls <remote>:<bucket-name>` against the one bucket the token
can actually see, combined with `no_check_bucket=true` in the rclone remote
config (since a scoped token also can't verify a bucket's existence via the
account-level API rclone would otherwise use by default).

The backup script (`pg-backup.sh`) does a compressed logical dump
(`pg_dump -Fc`), a sanity check that aborts if the dump file is suspiciously
small (catching a silent, empty, or truncated dump rather than uploading it
as if it were valid), an offsite copy via `rclone`, and local retention
pruning. It runs nightly via cron. Retention offsite was later handled by a
Cloudflare **R2 lifecycle rule** (auto-delete after 30 days) rather than a
delete loop in the script itself — deliberately, so the backup token never
needs delete permission for routine operation, further shrinking what a
compromised server could do to the backup history even in the worst case.
(True immutability — Object Lock / WORM — was scoped out as a "when you're
ready" future step, since it requires creating a *new* bucket with the
feature enabled at creation time; it cannot be retrofitted onto an existing
bucket.)

### Phase 14 — Monitoring, alerting, and log management

An **external** uptime monitor (UptimeRobot) was chosen deliberately over any
in-server monitoring solution, on the principle that a monitor running on
the box being monitored is useless the moment that box is the thing that's
down.

**A real, non-obvious bug was found and fixed here:** the uptime monitor
reported the API as *down* with a `404`, while a manual `curl` against the
same URL returned `200`. The cause: UptimeRobot's free tier probes with an
HTTP `HEAD` request by default (and the paid tier's "change HTTP method"
setting wasn't available), while the backend's router had only ever
registered a `GET` handler for `/healthcheck` — Gin does not automatically
serve `HEAD` for a `GET`-only route, so it fell through to the app's
`NoRoute` handler. The fix was made at the application level rather than
worked around at the monitor level: the healthcheck route now registers
`HEAD` alongside `GET`, using the same handler (Go's HTTP server
automatically omits the response body for `HEAD`). This is a more durable
fix than a monitor-specific setting, since it makes the endpoint correct for
*any* HEAD-probing monitor, not just this one.

A small alert-sending helper (`alert.sh`) was built on top of the existing
Resend integration, used by two other scripts: a disk-space checker (alerts
past 80% usage, checked every six hours) and the backup script itself (an
`ERR` trap emails on **any** failure — a backup that fails silently is worse
than having no backup at all, because it creates false confidence). The
initial alert recipient address was a placeholder guess and was corrected
once the operator specified it explicitly — infrastructure/ops alerts
(backup failures, disk warnings, deploy issues) route to the operator's
personal address, deliberately kept separate from the application's own
customer-facing/admin notification address, which was confirmed to remain
unchanged.

**Log rotation was set up in two genuinely separate systems, not one:**
Docker's own container logs (unbounded by default, a common way for a
self-hosted box to quietly fill its disk over months) were capped via
`/etc/docker/daemon.json` (`max-size`/`max-file`), which required a Docker
daemon restart and a recreate of every running container, since the log
driver's settings apply only at container *creation* time. Separately, the
plain-text script logs (`deploy.log`, `backup.log`, `monitor.log`) were
handed to the OS's own `logrotate`, via a config file in
`/etc/logrotate.d/`. A first attempt at this failed a dry run with
*"parent directory has insecure permissions"* — logrotate refuses by default
to rotate files in a directory it doesn't trust the ownership of; the fix
was adding an explicit `su <user> <user>` directive telling logrotate which
identity to rotate as.

### Phase 15 — Reducing noise: quiet 4xx logging and edge-level scanner blocking

Once the server was live on the public internet, it began receiving the
background noise every public IP receives — vulnerability scanners probing
for `.env`, `.git`, WordPress admin paths, and similar. Two fixes were made,
at two different layers, and they complement rather than duplicate each
other:

1. **Application-level:** every 4xx response (404, 401, 400, 405, 429) was
   found to be flowing through a single shared error-response helper that
   logged at **Error** level, and the logger was separately configured to
   attach a full stack trace to every Error-level log line
   (`zap.AddStacktrace(zapcore.ErrorLevel)`). The practical effect: a single
   scanner bot hitting a nonexistent path produced a full stack-trace log
   entry, indistinguishable in severity from a genuine server fault. The fix
   split the path: 4xx (client-caused) now logs at **Warn**, with useful
   structured context (method, path, IP, status) but no stack trace; only
   genuine 5xx (server-caused) faults keep Error-level logging with a trace.
2. **Edge-level, at Caddy:** a path matcher was added that returns an
   immediate `404` for a list of common scanner targets (`.php`, `.env`,
   `.git`, `wp-admin`, `phpmyadmin`, and similar) **before** the request ever
   reaches the Go application. This is a stronger mitigation than the
   logging fix alone — the worst-offending requests never consume backend
   resources or appear in its logs at all.

### Phase 16 — Cloudflare orange-cloud proxy and the origin firewall lock

This was the most technically involved phase, and it surfaced three distinct,
non-obvious problems in sequence. The goal: move from "DNS resolves straight
to the server" (grey cloud) to "Cloudflare's edge sits in front of every
request" (orange/proxied), for DDoS absorption and origin-IP hiding — done as
a deliberate hardening step once the core migration was stable, not a
day-one requirement.

**The certificate strategy decision.** Once proxied, the previous
Let's-Encrypt-via-HTTP-01 setup becomes unreliable, because the ACME
challenge would need to reach the real origin through Cloudflare's proxy
rather than resolving directly to it. Two options exist: a **DNS-01
challenge** (requires a custom Caddy build via `xcaddy` with a
Cloudflare-specific plugin — real, ongoing added complexity for a solo
operator), or a **Cloudflare Origin Certificate** (issued once, valid 15
years, installed as a static file, zero ongoing ACME dependency for this
domain). The Origin Certificate was chosen as the simpler, lower-maintenance
option appropriate to this project's scale.

**Sequencing mattered, and was done deliberately in this order:** install
and verify the Origin Certificate in Caddy *before* touching any Cloudflare
setting (verified locally with `curl -k` and `openssl s_client`, since the
Origin Cert is intentionally untrusted by default clients — that failure
mode is expected, not a bug); set Cloudflare's SSL/TLS mode to
**Full (strict)** *before* flipping DNS to proxied (reversing this order
risks a live SSL error loop); then flip the DNS record(s) — both `A` and
`AAAA` — to proxied.

**Problem 1 — a misleading browser test.** Immediately after flipping DNS,
a browser still displayed the raw Origin Certificate directly — which should
be impossible once traffic is proxied, since only Cloudflare's edge is
supposed to ever see that certificate. This was diagnosed, correctly, as a
**stale local/browser cache** (an already-open TLS session or cached DNS
answer) rather than a real misconfiguration — confirmed by querying a public
resolver directly (`dig @1.1.1.1 ...`), bypassing any local caching, which
showed both `A` and `AAAA` records correctly resolving to genuine Cloudflare
edge IP ranges. An incognito window / fresh connection resolved the visible
symptom immediately. **Lesson: when DNS or TLS state seems wrong right after
a change, rule out local caching with a public resolver before assuming the
change failed.**

**Problem 2 — firewall rules on the wrong chain.** With DNS correctly
proxied, the next step was ensuring the origin would refuse connections that
didn't come from Cloudflare — otherwise, anyone who already had the server's
real IP could still hit it directly, making the whole proxy setup
security-theater rather than a real control. UFW rules were added
restricting ports 80/443 to Cloudflare's published IP ranges — and a direct
connection test to the origin's real IP **still succeeded**. This reproduced
the exact caveat flagged back in Phase 4: **Docker's own iptables rules for
published container ports are evaluated ahead of UFW's chain**, so a UFW
"allow only Cloudflare" rule does nothing to traffic Docker is independently
forwarding to the Caddy container. The correct enforcement point for
Docker-published ports is the **`DOCKER-USER`** iptables chain (part of the
kernel's `FORWARD` path), which Docker guarantees it will always consult for
forwarded container traffic and will never silently overwrite — rules
allow-listing Cloudflare's ranges, with a catch-all `DROP` for everything
else on 80/443, were added there instead. (A generic, copy-pasted "fix" was
also evaluated at this point, and rejected: it assumed the container used
`network_mode: host`, which this project does not, and it referenced a
specific duplicate-rule line number that did not match the actual, verified
rule dump — a useful reminder that generic firewall advice must be checked
against the actual configuration in front of you, not assumed to transfer.)

**Problem 3 — a misleading self-test, the trickiest of the three.** Even
after the `DOCKER-USER` rules were correctly in place and verified populated
(~30 correctly-formed Cloudflare CIDR rules plus explicit `DROP` rules for
both port 80 and port 443), a test run **from the server itself, against its
own public IP**, still showed the connection succeeding. The real issue: a
host connecting to *its own* public IP address is a "hairpin" connection,
which can take a genuinely different path through the kernel's networking
stack than traffic arriving from the actual internet — in this case, very
likely terminating directly at Docker's userland-proxy (`docker-proxy`)
process, which can bind a real listening socket on the host itself for each
published port. A connection accepted by a socket that's actually listening
*on the host* is local delivery (`INPUT`-chain territory), and never touches
`FORWARD`/`DOCKER-USER` at all — meaning the self-test was structurally
incapable of proving anything about how a genuine external client would be
treated. **The test that actually mattered was run from a truly external
machine** (the operator's own laptop, on a different network) — which
correctly showed the connection blocked, confirming the firewall lock does
work for real traffic, and that the server's self-test result had been a red
herring the entire time. **Lesson, stated generally: never validate a
network-perimeter firewall rule by testing from behind that same perimeter —
the loopback/hairpin path is not representative of real external traffic.**

The `DOCKER-USER` rules were made persistent across reboots via
`iptables-persistent` / `netfilter-persistent save`. One item was
deliberately deferred rather than solved in this phase: Cloudflare's
published IP ranges can, rarely, change, and there is currently no automatic
refresh of the allow-list — noted as an open item in §8.

### Phase 17 — Secret rotation and decommissioning the old stack

Once the new infrastructure was fully verified — login working, a real
write path (an order) confirmed end-to-end, backups running unattended and
observed across multiple real nights, not just a single manual test — the
previous production secrets were rotated at their respective providers
(token signing key, payment processor key, storage keys, transactional email
key), and the previous hosting (the old PaaS backend, and the old managed
Postgres provider) were decommissioned. Secret rotation was sequenced with
one specific caveat in mind: rotating the token-signing key invalidates
every existing user session immediately, so it was done deliberately during
a low-traffic window rather than as a routine, anytime change.

---

## 3. Current Infrastructure

### 3.1 Server / OS

- Ubuntu (Contabo VPS), hardened per §2 Phase 1–5.
- SSH: key-only, root login disabled, password auth disabled (enforced via a
  `00`-prefixed drop-in file in `/etc/ssh/sshd_config.d/`, which wins over
  cloud-init's own drop-in by load order — see §7 for why this matters).
- `ufw`: default-deny inbound; allows SSH (22) plus 80/443 restricted to
  Cloudflare's published ranges at the packet-forwarding layer (see 3.4 —
  UFW's own 80/443 rules were superseded by `DOCKER-USER` rules, which are
  the layer that actually matters for Docker-published ports).
- `fail2ban`: active on SSH with default thresholds.
- `unattended-upgrades`: automatic security patches; automatic reboot
  intentionally **off**.
- Swap: a 2 GB swap file, `vm.swappiness=10`.

### 3.2 Docker / Docker Compose

Docker Engine installed from Docker's official `apt` repository. Compose
projects are organized by convention:

| Path | Contents |
|---|---|
| `~/infra/postgres/` | Postgres Compose file + `.env` (superuser password) |
| `~/infra/caddy/` | Caddy Compose file, `Caddyfile`, `certs/` (Origin Cert) |
| `~/apps/showtime/` | Backend Compose file + `.env` (all app secrets) |

**Convention:** shared infrastructure lives under `~/infra/`; individual
applications live under `~/apps/`. A second application would get its own
`~/apps/<name>/` directory following the same pattern.

### 3.3 Networking

Two **external** Docker networks (created once with `docker network create
<name>`, independent of any single Compose file, so multiple Compose
projects can all join them):

| Network | Members | Purpose |
|---|---|---|
| `web` | `caddy`, `showtime-backend` | Public-facing tier — only Caddy is meant to receive traffic from the internet. |
| `database` | `postgres`, `showtime-backend` | Private data tier — Postgres is never attached to `web`. |

Containers resolve each other by container name via Docker's built-in DNS
(e.g., the backend's `DB_URL` uses host `postgres`, never an IP address).
Containers not sharing a network cannot reach each other at all — this is a
structural guarantee, not a rule that can be misconfigured away, unlike a
firewall rule.

**Known trade-off, documented deliberately rather than accidentally:** every
application's backend currently shares the same `database` network, which
means app containers can technically reach each other over that network
(not just Postgres). Acceptable at the current single-operator, low-app-count
scale. The stricter alternative — giving each app its own private network
and attaching Postgres to each one individually (a container can belong to
multiple networks simultaneously) — is the documented upgrade path in §6 if
this ever needs tightening.

### 3.4 Reverse proxy and origin protection

Caddy is the **only** container with published ports (`80:80`, `443:443`,
`443:443/udp` for HTTP/3). It:

- Terminates TLS from Cloudflare's edge using a **Cloudflare Origin
  Certificate** (`~/infra/caddy/certs/origin-cert.pem` /
  `origin-key.pem`), referenced via an explicit `tls` directive in the
  Caddyfile — **not** Caddy's automatic Let's Encrypt management, which was
  deliberately disabled for this domain once the Origin Cert was installed.
- Routes to backend containers by hostname (`reverse_proxy
  showtime-backend:8080`).
- Blocks a list of common vulnerability-scanner request paths (`.env`,
  `.git`, `wp-admin`, `.php`, etc.) with an immediate `404`, before the
  request reaches the Go application.

**Origin protection is enforced at the `DOCKER-USER` iptables chain**, not
UFW, because Docker's own port-publishing rules are evaluated ahead of UFW's
for any port a container publishes (see §7). The `DOCKER-USER` chain
contains an explicit `ACCEPT` rule per Cloudflare-published CIDR range (both
IPv4 and IPv6) for ports 80 and 443, an `ACCEPT` for already-established
connections, and a catch-all `DROP` for ports 80 and 443 from any other
source. These rules are persisted across reboots via `iptables-persistent`.

### 3.5 TLS/SSL

Two independent certificates, one per hop (see §1.2's diagram): Cloudflare's
own automatically-managed public certificate for the browser-facing hop, and
the Cloudflare Origin Certificate (15-year validity, installed manually,
zero ACME dependency) for the Cloudflare-to-origin hop. Cloudflare's
SSL/TLS mode is set to **Full (strict)**, meaning Cloudflare will only
forward traffic to an origin presenting a certificate it can verify — which
the Origin Certificate satisfies by design.

### 3.6 Volumes and persistence

| Volume | Attached to | Holds |
|---|---|---|
| `pgdata` (named volume) | `postgres` | All database files. Survives container recreation/image upgrades. |
| `caddy_data` (named volume) | `caddy` | TLS state — **must** persist; losing it means re-requesting certificates. |
| `caddy_config` (named volume) | `caddy` | Caddy's autosaved runtime config. |
| `./certs/` (bind mount) | `caddy` | The Cloudflare Origin Certificate + key (`ro`). |

Postgres uses a **named volume**, not a bind mount, which is the recommended
default for databases (avoids file-ownership friction and reduces the risk
of an accidental `rm -rf` against a plain host directory). Durability beyond
the volume itself is handled by the separate backup system (§3.10) — a
named volume protects against *container* loss, not disk/host loss or
operator error, which is what backups are for.

### 3.7 Environment and secrets

Every secret lives in one of two places: a provider's dashboard (Cloudflare,
GitHub, Resend, Paystack, R2), or a `chmod 600` `.env` file on the server.
Nothing secret is ever committed to git or baked into a Docker image.

| Secret | Location |
|---|---|
| App secrets (`TOKEN_KEY`, Paystack, Resend, R2, `DB_URL`) | `~/apps/showtime/.env` |
| Postgres superuser password | `~/infra/postgres/.env` |
| `showtime` DB user password | `~/infra/postgres/showtime-db-password.txt` |
| Backup R2 token | `~/.config/rclone/rclone.conf` |
| CI deploy key | GitHub secret `DEPLOY_SSH_KEY`; public half in the server's `authorized_keys` |

After editing `~/apps/showtime/.env`, changes take effect with:
`cd ~/apps/showtime && docker compose up -d --force-recreate`.

### 3.8 Logging

Two independent systems, covering two independent kinds of logs:

- **Docker container logs** (backend, Postgres, Caddy stdout/stderr) are
  capped via `/etc/docker/daemon.json` (`json-file` driver, `max-size`,
  `max-file`). This applies at container *creation* time — changing it
  requires recreating existing containers to take effect.
- **Script logs** (`~/deploy.log`, `~/backups/backup.log`,
  `~/backups/monitor.log`) are managed by the OS's own `logrotate`, via
  `/etc/logrotate.d/showtime`.
- **System/package logs** (SSH, `fail2ban`, `unattended-upgrades`, etc.) are
  already covered by the logrotate configs those packages install
  themselves on `apt install` — no action was needed for these.

### 3.9 Monitoring

| Layer | Tool | Behavior |
|---|---|---|
| Uptime | UptimeRobot (external) | Polls the public healthcheck URL every 5 minutes; emails on failure. |
| Disk space | `~/scripts/disk-check.sh` via cron, every 6h | Silent when healthy; emails past an 80% threshold. |
| Backup health | `ERR` trap inside `~/scripts/pg-backup.sh` | Emails immediately on any backup failure. |
| Alert delivery | `~/scripts/alert.sh` | Sends via the Resend API; used by both scripts above. |

### 3.10 Scheduled jobs (cron)

```
0 3 * * *   /home/<user>/scripts/pg-backup.sh   >> ~/backups/backup.log  2>&1
0 */6 * * * /home/<user>/scripts/disk-check.sh  >> ~/backups/monitor.log 2>&1
```

### 3.11 Security hardening summary

- Key-only SSH, root login disabled, password auth disabled.
- `ufw` default-deny inbound.
- `fail2ban` on SSH.
- Automatic OS security patches (manual reboot review).
- Postgres unreachable from the internet; loopback-only for tunneled GUI
  access; least-privilege application database user, never the superuser.
- No secrets in the image, in git, or in this document.
- CI deploy key is forced-command-restricted — it can run exactly one
  script and nothing else, even if it leaked.
- Backup credentials are isolated from application credentials, and scoped
  to a single bucket.
- Origin server only accepts 80/443 from Cloudflare's published IP ranges,
  enforced at the `DOCKER-USER` chain (verified from a genuinely external
  network, not just locally).
- Explicit `CORS_ALLOW_ORIGINS` allow-list (closes a wildcard fallback that
  exists in the application code for unconfigured production deployments).
- Application-level scanner-probe noise reduction, plus edge-level blocking
  of common scanner paths before they reach the application at all.

### 3.12 Deployment workflow

See §5.1 for the operational steps. In summary: `git push` to `main` on
backend-relevant paths triggers a GitHub Actions build, which pushes a new
image to `ghcr.io` and then, only on success, SSHes into the server (using
the restricted deploy key) to run `~/scripts/deploy.sh`, which pulls the new
image, recreates the container, and prunes old images.

### 3.13 Backups

Nightly `pg_dump` (custom compressed format), stored locally
(`~/backups/postgres/`, 14-day local retention) and offsite in a dedicated,
bucket-scoped Cloudflare R2 bucket (30-day retention via an R2 lifecycle
rule, not a script-side delete loop — see §2 Phase 13 for the reasoning).
Any failure — including a suspiciously small/empty dump — triggers an
immediate email alert.

---

## 4. Configuration Reference

| Setting | What it does | Why it exists | Where it lives | How to change safely | Impact of changing |
|---|---|---|---|---|---|
| `postgres:18` image tag | Pins the Postgres major version | Prevents an accidental major-version jump, which would break the on-disk data format | `~/infra/postgres/docker-compose.yml` | Never bump the major version without a deliberate dump/restore migration plan | Bumping the major version in place will likely prevent Postgres from starting at all against the existing volume |
| `shared_buffers`, `effective_cache_size`, `work_mem`, `maintenance_work_mem`, `max_connections` | Postgres memory tuning | Balances DB cache performance against leaving RAM for other containers on a shared VPS | `command:` block in `~/infra/postgres/docker-compose.yml` | Edit values, then `docker compose up -d` (requires a container restart to take effect) | Setting `work_mem` too high is the most dangerous — it multiplies per sort operation *per connection*, and can exhaust memory under concurrent load |
| Postgres port publish (`127.0.0.1:5432:5432`) | Exposes Postgres to the host machine only | Enables SSH-tunneled GUI access without exposing the database publicly | `~/infra/postgres/docker-compose.yml` | Never change the bind address from `127.0.0.1` to `0.0.0.0` or a bare port number | A bare `5432:5432` (no `127.0.0.1:` prefix) would expose the database to the entire internet |
| `AUTO_MIGRATE` | Whether the backend runs DB migrations automatically on boot | Convenient default; trade-off is a bad migration can crash startup | `~/apps/showtime/.env` | Set `false` and run migrations as a separate, deliberate deploy step once migrations need more control | With it off, new migrations require a manual step (not yet built — see §8) |
| `CORS_ALLOW_ORIGINS` | Explicit CORS allow-list | Without it, production silently falls back to trusting any `*.vercel.app` origin (a real credential-theft vector, since the API sends credentialed cookies) | `~/apps/showtime/.env` | Add/remove exact origins (comma-separated); always keep at least one value set in production | Removing this entirely in production re-opens the wildcard fallback |
| `COOKIE_DOMAIN` | Sets the `Domain` attribute on the auth cookie | Left unset deliberately — produces a host-only cookie scoped to the API's own hostname | `~/apps/showtime/.env` (currently absent) | Only set this if multiple subdomains need to share one auth cookie | Setting it incorrectly can silently break login (browsers reject cookies whose domain doesn't match) |
| Docker `log-opts` (`max-size`, `max-file`) | Caps container log file size | Prevents unbounded container logs from filling the disk | `/etc/docker/daemon.json` | Edit, then `sudo systemctl restart docker` (brief downtime for all containers) followed by recreating each Compose stack | Applies only to containers created *after* the change — existing containers must be recreated |
| `logrotate` config for script logs | Rotates/compresses/expires `deploy.log`, `backup.log`, `monitor.log` | Prevents these growing unbounded | `/etc/logrotate.d/showtime` | Edit `rotate N` (count) and/or `weekly`/`daily` (frequency); test with `sudo logrotate -d <file>` before trusting it | Requires `su <user> <user>` if the log directory isn't root-owned, or rotation silently skips those files |
| `DOCKER-USER` iptables rules | Restricts 80/443 to Cloudflare's IP ranges | The only enforcement point that actually applies to Docker-published ports (UFW alone does not) | Applied via `iptables`/`ip6tables`, persisted with `iptables-persistent` | Re-run the Cloudflare-range allow-list loop if Cloudflare's published ranges change; always keep the RELATED,ESTABLISHED accept rule and the SSH port unaffected | Getting the ordering or the catch-all `DROP` wrong can either leave the origin open or (if SSH were ever mistakenly included) lock out all access |
| Cloudflare SSL/TLS mode | Controls how Cloudflare validates the origin's certificate | Must be `Full (strict)` to match the Origin Certificate | Cloudflare dashboard → SSL/TLS → Overview | Only change together with a matching certificate strategy on the origin | Mismatching this with what the origin actually presents can cause an SSL error loop for all visitors |
| `pg-backup.sh` retention (`RETENTION_DAYS`) | Local backup retention | Offsite retention is handled separately by an R2 lifecycle rule | `~/scripts/pg-backup.sh` | Change the local retention window; confirm disk space accommodates it | Longer retention costs local disk space, not R2 cost |
| R2 lifecycle rule (30 days) | Offsite backup retention | Avoids the backup script itself needing delete permission | Cloudflare R2 dashboard → bucket → Settings → Object lifecycle rules | Adjust the day count in the dashboard | Shorter windows reduce disaster-recovery lookback; the script's local copies are a separate, shorter-lived safety net |
| `disk-check.sh` `THRESHOLD` | Disk-space alert trigger | 80% chosen as an actionable-but-not-too-late warning point | `~/scripts/disk-check.sh` | Adjust the percentage | Too high risks missing the warning window; too low creates alert fatigue |

---

## 5. Operations Runbook

### 5.1 Deploy the backend

**Normal path — automatic:**
```
git push origin main    # on any backend-relevant path change
```
Watch the Actions tab: `build-and-push` → `deploy`, both must go green.

**Manual full pipeline** (rebuild + redeploy current `main`, no code change):
```
gh workflow run deploy-backend.yml
```

**Redeploy the existing image only** (no rebuild — e.g. after editing `.env`):
```
~/scripts/deploy.sh
```

### 5.2 Restart a service

```
docker compose -f ~/apps/showtime/docker-compose.yml restart backend
docker compose -f ~/infra/postgres/docker-compose.yml restart postgres
docker compose -f ~/infra/caddy/docker-compose.yml restart caddy
```

### 5.3 Inspect logs

| What | Where |
|---|---|
| Deploy history | `tail -f ~/deploy.log` |
| Backend application logs | `docker compose -f ~/apps/showtime/docker-compose.yml logs -f backend` |
| Postgres logs | `docker compose -f ~/infra/postgres/docker-compose.yml logs -f` |
| Caddy / TLS logs | `docker compose -f ~/infra/caddy/docker-compose.yml logs -f` |
| Backup history | `tail ~/backups/backup.log` |
| CI deploy output | GitHub Actions → the run → `deploy` job |

### 5.4 Health checks

```
curl -s https://<api-domain>/api/v1/healthcheck
docker compose -f ~/apps/showtime/docker-compose.yml ps    # look for "healthy"
docker compose -f ~/infra/postgres/docker-compose.yml ps   # look for "healthy"
```

### 5.5 Rollback

Every image is also tagged with its exact commit SHA at build time. To roll
back:
```
# on the server
cd ~/apps/showtime
# edit docker-compose.yml: image: ghcr.io/<owner>/<repo>:sha-<known-good-commit>
docker compose pull
docker compose up -d
```
Revert the `docker-compose.yml` image tag back to `:latest` once a fixed
image has been pushed through the normal pipeline.

### 5.6 Backup and restore

**Manual backup (outside the nightly cron):**
```
~/scripts/pg-backup.sh
```

**Restore a specific dump:**
```
rclone copy r2backup:<backup-bucket>/<dump-filename>.dump ~/
docker exec -i postgres sh -c \
  "PGPASSWORD='<showtime-db-password>' pg_restore -h 127.0.0.1 -U showtime -d showtime --clean --if-exists" \
  < ~/<dump-filename>.dump
```
For a full reset-and-restore: stop the backend first, then
`DROP DATABASE showtime WITH (FORCE)` / `CREATE DATABASE showtime OWNER
showtime` before restoring.

**An untested backup is not a backup** — periodically restore into a
throwaway database (`CREATE DATABASE showtime_restore_test;`) to prove the
process still works end-to-end.

### 5.7 Certificate renewal

- **Cloudflare edge certificate** (browser-facing): fully automatic,
  Cloudflare-managed. No action ever required.
- **Origin Certificate** (Cloudflare-to-origin): valid until 2041. No routine
  renewal needed. If it's ever revoked or needs replacing, generate a new one
  in the Cloudflare dashboard (SSL/TLS → Origin Server) and replace the two
  files under `~/infra/caddy/certs/`, then `docker compose up -d
  --force-recreate` for the `caddy` service.

### 5.8 Disk cleanup

```
docker image prune -a          # remove unused images (safe; re-pulled on next deploy)
du -sh ~/backups/postgres/*    # check local backup sizes
```

### 5.9 Troubleshooting entry point

Start with §7 (Troubleshooting) below for a symptom-indexed table. General
first steps: check the relevant `docker compose ps` for health status, then
the relevant log source from §5.3.

---

## 6. Maintenance Guide

Worked examples for the most likely tuning changes:

**Example: changing script-log retention from 4 weeks to a different window.**
1. Where it lives: `/etc/logrotate.d/showtime`.
2. What to change: the `rotate N` value (currently `4`) and/or `weekly` →
   `daily`/`monthly`.
3. Verify: `sudo logrotate -d /etc/logrotate.d/showtime` (dry run — shows
   what *would* happen without changing anything).
4. Confirm new behavior: after the next natural rotation window passes,
   check `ls -la ~/deploy.log*` for the expected number of `.gz` archives.

**Example: raising the disk-space alert threshold.**
1. Where it lives: `THRESHOLD=80` in `~/scripts/disk-check.sh`.
2. What to change: the percentage value.
3. Verify: temporarily set it below current usage (e.g. `THRESHOLD=0`) and
   run `~/scripts/disk-check.sh` by hand — confirm an alert email arrives —
   then restore the real threshold.
4. Confirm ongoing behavior: nothing further needed; the cron job picks up
   the new value on its next run.

**Example: adding a second application to this server.**
1. DNS: create an `A`/`AAAA` record for the new subdomain, pointed at the
   server, proxied (orange) to match the existing setup.
2. Give the app its own `~/apps/<name>/` directory and Compose file, joining
   the `web` network (for Caddy) and, if it needs one, the `database`
   network.
3. Create a dedicated database and least-privilege user for it inside the
   existing shared Postgres instance (never reuse the `showtime` user):
   ```sql
   CREATE USER <app> WITH PASSWORD '...';
   CREATE DATABASE <app> OWNER <app>;
   \c <app>
   REVOKE ALL ON SCHEMA public FROM PUBLIC;
   GRANT ALL ON SCHEMA public TO <app>;
   ```
4. Add a new site block to `~/infra/caddy/Caddyfile` and reload Caddy.
5. No firewall changes needed — the `DOCKER-USER` Cloudflare allow-list
   already covers any container Caddy fronts.

**Example: tuning Postgres memory if RAM pressure changes.**
1. Where it lives: the `command:` block in
   `~/infra/postgres/docker-compose.yml`.
2. What to change: `shared_buffers` (cache allocation),
   `effective_cache_size` (planner hint only, not an allocation), `work_mem`
   (per-sort-operation, per-connection — the most dangerous to raise
   carelessly).
3. Verify: `docker exec -it postgres psql -U postgres -c "SHOW
   shared_buffers;"` after recreating the container.
4. Confirm: monitor `free -h` on the host after the change under normal
   load to confirm no memory pressure was introduced for other containers.

---

## 7. Troubleshooting

Issues actually encountered during this build, in the form symptom → root
cause → resolution → prevention:

**Symptom:** Password authentication still works over SSH after explicitly
disabling it.
**Root cause:** `sshd` reads `/etc/ssh/sshd_config.d/*` alphabetically, and
the *first* value read for a given directive wins. A pre-existing
`50-cloud-init.conf` set `PasswordAuthentication yes` and was read before
the intended fix.
**Resolution:** add a new drop-in file with a lower sort-order prefix (e.g.
`00-hardening.conf`) so it's read — and wins — first.
**Prevention:** always check `grep -r <directive> /etc/ssh/sshd_config.d/`
after any SSH config change, not just the main config file.

**Symptom:** Backend fails to connect to Postgres with a confusing DSN
parse error.
**Root cause:** the database password (generated with `openssl rand
-base64`) contained `/` characters, which broke the `postgres://` URL parser.
**Resolution:** regenerate the password with `openssl rand -hex`, which is
always URL-safe, and update the user's password with `ALTER USER ... WITH
PASSWORD`.
**Prevention:** always generate any password destined for a URL/DSN with
`openssl rand -hex`, never `-base64`.

**Symptom:** Database migration fails with `function uuid_generate_v4() does
not exist`.
**Root cause:** two migrations relied on the `uuid-ossp` extension, which
managed Postgres providers pre-install but a vanilla self-hosted image does
not.
**Resolution:** changed those two migrations to use the built-in
`gen_random_uuid()` instead, matching the rest of the schema; swept the full
migration set for any other extension dependency (none found).
**Prevention:** avoid extension-dependent functions in migrations meant to
run against a vanilla Postgres image; prefer built-ins.

**Symptom:** An external uptime monitor reports the API down (`404`) while
manual `curl` returns `200`.
**Root cause:** the monitor probes with `HEAD`; the healthcheck route was
only registered for `GET`, and Gin does not auto-serve `HEAD` for `GET`-only
routes.
**Resolution:** registered `HEAD` alongside `GET` on the healthcheck route,
reusing the same handler.
**Prevention:** health endpoints intended for uptime monitoring should
answer both `GET` and `HEAD` from the start.

**Symptom:** `logrotate -d` dry run reports *"skipping ... because parent
directory has insecure permissions."*
**Root cause:** logrotate refuses to rotate files in a directory it can't
confirm is owned appropriately (world/group-writable check).
**Resolution:** add an explicit `su <user> <user>` directive to the
logrotate config block.
**Prevention:** always run `logrotate -d` after writing a new config, before
assuming it will work on schedule.

**Symptom:** `rclone lsd <remote>:` returns `403 AccessDenied` even though
the token is valid.
**Root cause:** the token is intentionally scoped to a single bucket, and
`lsd` (list all buckets) is an account-level operation the scoped token
cannot perform — this is the token correctly enforcing its scope, not a
misconfiguration.
**Resolution:** use `rclone ls <remote>:<bucket-name>` against the specific
bucket instead, and set `no_check_bucket=true` in the rclone remote config.
**Prevention:** understand the difference between bucket-scoped and
account-scoped tokens before assuming an access-denied error is a bug.

**Symptom:** A direct connection test to the server's public IP on port 443
succeeds, even after adding UFW rules that should restrict it to Cloudflare
only.
**Root cause:** Docker writes its own iptables NAT/forwarding rules for
published container ports, evaluated *ahead of* UFW's own chain — a UFW
allow-list has no effect on traffic Docker is independently forwarding.
**Resolution:** apply the Cloudflare-only allow-list (plus a catch-all
`DROP`) to the `DOCKER-USER` iptables chain instead, which Docker guarantees
it will always consult and never silently overwrite.
**Prevention:** for any Docker host, firewall rules meant to restrict access
to *published container ports* belong in `DOCKER-USER`, not (only) UFW.

**Symptom:** Even after correctly configuring `DOCKER-USER` rules, a test run
**from the server itself** against its own public IP still shows the
connection succeeding.
**Root cause:** a host connecting to its own public IP is a "hairpin"
connection that can take a different kernel path than genuine external
traffic — very likely terminating at Docker's userland-proxy
(`docker-proxy`) process, which can bind a real listening socket directly on
the host for each published port, meaning the connection is handled by
local delivery (`INPUT`) rather than forwarding (`FORWARD`/`DOCKER-USER`) at
all.
**Resolution:** re-test from a genuinely external machine (a different
network entirely) — this is the test whose result actually matters.
**Prevention:** never validate a network-perimeter firewall change by
testing from behind that same perimeter.

**Symptom:** A generic, copy-pasted firewall "fix" document doesn't match
observed behavior (references a rule/line number that doesn't exist; assumes
a networking mode not in use).
**Root cause:** the document's diagnosis assumed `network_mode: host`, which
this project's Caddy container does not use (it uses standard bridge
networking with explicit `ports:` publishing).
**Resolution:** verified the actual, current `iptables -L DOCKER-USER -n
--line-numbers` output directly rather than trusting the document's claims,
and proceeded from the real evidence.
**Prevention:** treat any firewall/networking advice — especially anything
copied from an external source — as a hypothesis to verify against your
actual configuration, not a fact to apply blindly.

**Symptom:** Concern about CI/CD "wasting free minutes" leads to considering
disabling or commenting out a test workflow.
**Root cause:** a mistaken assumption that GitHub Actions minutes are a
scarce resource on this repository.
**Resolution:** confirmed the repository is public, and GitHub Actions is
free and unlimited for public repositories — there is no minutes budget to
protect.
**Prevention:** check a repository's actual visibility/plan limits before
optimizing around an assumed constraint.

---

## 8. Future Improvements

Open items, deliberately deferred rather than forgotten:

- **Automatic refresh of Cloudflare's IP allow-list.** Cloudflare's
  published ranges rarely change, but there is currently no automation to
  detect and re-sync them in the `DOCKER-USER` chain — a stale allow-list
  could eventually cause legitimate traffic to be dropped without an obvious
  cause. A small monthly cron re-running the allow-list loop would close
  this.
- **R2 Object Lock (true backup immutability).** The current backup token
  can still delete objects (mitigated by using an R2 lifecycle rule instead
  of script-side deletion, and by scoping the token to a single bucket).
  Genuine ransomware-resistant, undeletable-for-N-days backups require R2's
  Object Lock feature, which can only be enabled at bucket *creation* — this
  would mean migrating to a new, lock-enabled bucket.
- **Gated migrations instead of `AUTO_MIGRATE=true`.** Currently migrations
  run automatically on backend boot. A safer pattern for a maturing
  production system is a separate, deliberate migration step in the deploy
  pipeline, with `AUTO_MIGRATE=false` in normal operation.
- **Per-app network isolation.** All app backends currently share the
  `database` network and can technically reach each other. If a second app
  is added and stricter isolation becomes worthwhile, give each app its own
  network and attach Postgres to each individually.
- **Database-per-app instance, if any single app's load grows enough to
  affect others.** Currently deliberately shared for efficiency at this
  scale; the migration path (dump/restore into a dedicated instance) is
  straightforward if warranted later.
- **Observability beyond uptime/disk/backup alerts.** No centralized log
  aggregation, request tracing, or metrics dashboard yet — deferred as a
  "later" item from the start of this project, appropriate for the current
  scale but worth revisiting if traffic or team size grows.
- **Consider PgBouncer** if/when `max_connections=100` becomes a real
  constraint under load, rather than raising it directly (which increases
  per-connection overhead linearly).
