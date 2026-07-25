# Production Infrastructure Playbook

**Purpose:** this document captures reusable engineering judgment for
building production infrastructure on a self-managed server (a single VPS or
similar), independent of any one project. It is deliberately free of
project-specific paths, IPs, or commands — those belong in a project's own
operations manual. Use this as a blueprint for sequencing, decision-making,
and avoiding known pitfalls the next time similar infrastructure is built.

The philosophy throughout: **explain why an approach is chosen over its
alternatives**, including the cost and maintenance burden of each, rather
than prescribing one "correct" answer. Match the choice to the actual scale
and risk profile of the project — over-engineering has a real, ongoing cost
too.

---

## 1. Recommended build order, and why this order

Building in the wrong order creates rework and, worse, creates windows where
something is exposed before it's protected. The order below is designed so
that **each phase's safety net exists before the phase that would need it.**

1. **Access control before anything else.** Key-based authentication,
   disabling root/password login, and a default-deny firewall — done before
   installing any application software. Rationale: every subsequent phase
   assumes the machine is already only reachable by its intended operator.
   Installing software first and "hardening later" leaves a real window
   where a fresh, unhardened machine is internet-facing.
2. **OS-level resilience next: automatic security patching, and a swap
   safety net if RAM is modest.** These are cheap, low-risk, and reduce the
   chance that a later phase gets undermined by an unrelated OS-level
   failure (an unpatched vulnerability, or an OOM kill of the wrong
   process).
3. **Container runtime, with its own gotchas understood before relying on
   them.** Specifically: understand *before* it matters that a container
   runtime's own network rules can interact with (and sometimes bypass) the
   OS firewall for published ports. This is covered in depth in §4.
4. **The data layer, before the application layer.** A database that's
   already tuned, network-isolated, and has at least one verified backup
   path should exist *before* real data is ever written to it — retrofitting
   backups onto a database that already holds irreplaceable data is a much
   riskier position to design from.
5. **CI/CD for building and publishing artifacts, before automating
   deployment.** Get a reliable, repeatable build pipeline working and
   manually verify one deployment by hand before automating the trigger.
   Automating a process you have never watched succeed manually just means
   debugging two new things at once when it first breaks.
6. **The public-facing edge (reverse proxy, TLS) after the data layer is
   solid, not before.** There's no reason to expose anything to the public
   internet until there's something real and correctly-persisted behind it.
7. **Monitoring, alerting, and log management, once there is something
   worth monitoring.** Ideally before real user traffic arrives, so the
   first real incident is not also the first time anyone sees whether
   alerting actually works.
8. **Perimeter hardening (CDN/DDoS proxy, origin IP concealment) as a
   deliberate, later hardening pass, not a day-one requirement** — unless
   the project's threat model specifically demands it from day one (e.g., a
   known target, or a compliance requirement). Get the core system correct
   and stable first; add this layer once there's a stable baseline to
   harden further.
9. **Secret rotation and decommissioning of any previous
   infrastructure only after the new system has been observed working
   correctly over real time** — not immediately after the first successful
   deploy. "Working once" and "working reliably" are different bars, and
   rotating a signing secret or tearing down a fallback platform is much
   easier to reverse *before* you've committed to it than after.

---

## 2. Design decisions and trade-offs

### 2.1 Container orchestration: Compose vs. Kubernetes vs. bare processes

| Approach | When it fits | Cost |
|---|---|---|
| Bare processes (systemd units, no containers) | Absolute simplest case, single language runtime, one operator | No isolation between apps' dependencies; harder to reproduce environments |
| Docker + Compose | Single host or a small, fixed number of hosts; one or a handful of operators | Manual scaling across hosts; no built-in orchestration for failover |
| Kubernetes | Multiple hosts, need for automated scheduling/scaling/self-healing, a team operating it | Substantial operational complexity and a real learning curve; frequently not justified below a certain team size or scale |

**General guidance:** default to the simplest option that fits current
scale, and treat "we might need to scale later" as a reason to keep
architecture *portable* (containerized, stateless where possible), not a
reason to adopt orchestration complexity today. Compose on a single
well-specified VPS comfortably serves far more traffic than people assume
before Kubernetes' operational overhead starts paying for itself.

### 2.2 Database hosting: self-hosted vs. managed

| | Self-hosted (in a container you control) | Managed service |
|---|---|---|
| Cost | Lower at moderate scale; you pay for the VPS, not a managed premium | Often higher per unit of compute/storage, but includes ops |
| Control | Full control over tuning, backup strategy, network topology | Limited to what the provider exposes |
| Operational burden | You own patching, tuning, backup verification, and failure recovery | Provider owns most of this |
| Appropriate when | You have (or are building) the operational discipline to run backups/monitoring properly, and want cost/control | You want to trade money for not thinking about database operations at all |

**A specific trap worth naming:** a database that "just works" on a managed
provider often relies on conveniences the provider pre-configured invisibly
(certain extensions pre-installed, generous default connection limits, etc).
Migrating an existing schema onto a self-hosted instance can surface these
as failures that look like bugs in the schema but are actually just missing
provider-specific setup. Audit for extension/feature dependencies explicitly
during any such migration rather than assuming a vanilla install will behave
identically.

### 2.3 Single shared database instance vs. one instance per application

If a single host will eventually run multiple applications, decide this
deliberately rather than by default:

| | One shared instance, isolated by database + user | One instance per app |
|---|---|---|
| Resource efficiency | Better on a single modest host | Each instance has its own baseline overhead |
| Blast radius | A single app's heavy load or compromise can affect the whole instance's resources | Fully isolated |
| Upgrade/maintenance windows | Shared across all apps | Independent per app |
| Recommended for | A single operator, modest scale, cost-sensitive | Higher-scale, multi-team, or when one app's reliability must not depend on another's behavior |

If choosing shared: enforce isolation at the **database + user** level
(least-privilege credentials per application, never a shared superuser for
app connections) even though the underlying process is shared. This gets
most of the safety of full isolation at a fraction of the resource cost.

### 2.4 Reverse proxy choice

| Option | Strength | Cost |
|---|---|---|
| Caddy | Automatic HTTPS, minimal configuration, best for a single operator or small team learning the stack | Smaller ecosystem than Nginx; fewer examples for exotic configs |
| Nginx | Maximum control, huge ecosystem/prior art | Manual TLS cert management (or bolt-on tooling), more verbose config |
| Traefik | Auto-discovers containers via labels, strong for many services on one host | Steeper learning curve; more moving parts to reason about |

**General guidance:** Caddy is the strongest default for a small team that
wants automatic TLS without dedicated ops time. Traefik earns its complexity
once you're running many services and want label-driven auto-configuration.
Nginx remains the right call when you need very specific, low-level control
Caddy doesn't expose, or you're joining a team that already standardizes on
it.

### 2.5 TLS/certificate strategy, especially once a CDN/proxy is involved

- **Direct-to-origin, DNS resolves straight to your server:** a standard
  ACME HTTP-01 challenge (e.g., Caddy or certbot with Let's Encrypt) is the
  simplest, fully automatic option.
- **Behind a proxying CDN (e.g., Cloudflare in "proxied" mode):** HTTP-01
  becomes unreliable, because DNS no longer resolves to your real origin.
  Two real options: a **DNS-01 challenge** (requires your ACME client to
  support a DNS provider plugin — often means a custom build of the proxy
  software, real ongoing complexity), or a **provider-issued origin
  certificate** (e.g., Cloudflare Origin Certificates) — typically
  long-validity, installed as a static file, trusted only by the CDN/proxy
  itself and deliberately not by the public internet. For a small team, the
  origin-certificate approach is usually the better trade: it avoids a
  custom build and an ongoing DNS-01 dependency, at the cost of the
  certificate being provider-specific rather than a universally portable
  Let's Encrypt cert.
- **Key mental model, regardless of which is chosen:** once a proxy sits in
  front of your origin, there are **two separate TLS hops**, each validated
  by whoever is actually on the other end of that specific connection — the
  public client validates the proxy's certificate; the proxy (not the
  public client) validates the origin's certificate. Don't expect a
  certificate meant for the second hop to satisfy a direct client connecting
  to the origin — that failure is by design, not a misconfiguration.

### 2.6 CI/CD and deployment workflow

**Recommended shape for a small team on a self-managed server:** CI builds
and publishes a versioned artifact (a container image, tagged both with a
mutable "latest"-style tag and an immutable commit-based tag); a separate,
minimal trigger tells the server to pull and run the new artifact. Keep the
*build* logic in CI (where it's portable, has good logs, and doesn't
compete with production for resources) and the *deploy* logic on the server
itself (a small script the CI trigger calls), rather than embedding deploy
logic inside the CI configuration — this keeps the deploy mechanism
inspectable and testable independent of CI, and lets an operator run the
same deploy by hand when needed.

**Securing the CI-to-server trigger:** whatever credential CI uses to reach
the server should be scoped as narrowly as technically possible — ideally a
dedicated credential that can execute *only* the deploy action and nothing
else, so that even a full leak of that credential has a bounded blast
radius. A forced-command-restricted SSH key (or equivalent least-privilege
mechanism on your platform) is the general pattern.

**Always tag artifacts with something immutable (a commit SHA), not just a
mutable tag.** The mutable tag is what you deploy day-to-day; the immutable
tag is what makes rollback possible without rebuilding.

**Gate the build on the test suite, in the same pipeline — not in a
separate, independently-triggered one.** A common mistake: a test/lint
workflow and a build/deploy workflow both trigger on the same event (e.g.
push to main) but have no dependency on each other, because job-level
`needs:` only works *within* a single workflow file. The result is that a
red test run and a green deploy can happen side by side, with nothing
actually stopping the deploy. Either put the test step in the same workflow
as the build (simplest, self-contained), or use your CI platform's
cross-workflow dependency mechanism explicitly and deliberately — don't
assume two same-triggered workflows are implicitly sequenced.

**A deploy is not "done" the moment the new process starts — verify it
before finalizing.** "The container/process started" and "the
container/process is actually working" are different facts, and treating
the first as proof of the second is how a deploy can silently leave a
crash-looping service in production. The deploy step should actively confirm
the new version is healthy (a liveness/health endpoint, a defined readiness
check) within a bounded timeout *before* doing anything irreversible, such as
deleting the previous version's artifact. If the new version never becomes
healthy, the deploy script should treat that as a failure — ideally
rolling back to the last-known-good version automatically and alerting,
rather than leaving a human to notice the outage first.

**Don't let cleanup destroy your rollback path.** A deploy script that
prunes/deletes the previous artifact *unconditionally*, rather than only
after confirming the new one is healthy, removes the fastest recovery option
at exactly the moment it might be needed.

### 2.7 Secrets management

- Never in source control, never baked into a build artifact.
- A build artifact (container image) that contains no secrets can safely be
  public, even if the source repository is public — visibility of the image
  doesn't have to track visibility of secrets, since secrets should be
  injected at runtime, not baked in.
- Provider dashboards (for third-party API keys) and a permissions-locked
  environment file on the server (for everything else) are usually
  sufficient for a small team; a dedicated secrets manager becomes
  worthwhile once the number of environments/services/operators grows
  enough that manual `.env` file management becomes error-prone.
- Isolate backup credentials from application credentials. A credential an
  application uses in normal operation should not also be able to delete or
  overwrite your backup history — otherwise a compromise of the running
  application is also a compromise of your disaster-recovery plan.
- Treat any credential shared outside its intended storage (pasted into a
  chat, a ticket, a doc) as compromised and rotate it — don't rely on
  "probably no one saw it."

### 2.8 Logging strategy

Distinguish clearly between (at least) three independent logging concerns,
each with its own retention mechanism — conflating them leads to gaps:

1. **Application/container logs** — usually need a size/count cap at the
   container-runtime level, since they can otherwise grow unbounded and
   quietly fill a disk over weeks or months.
2. **Operational script logs** (deploy scripts, backup scripts, cron jobs) —
   plain files that need their own rotation policy (age- or size-based),
   independent of the container runtime's own log handling.
3. **System/package logs** — often already handled by the OS's own tooling
   the moment the relevant package is installed; verify this rather than
   assuming a gap exists where none does.

**Separately, tune log *severity*, not just retention.** A shared
"log the error and respond" code path is a common source of noise: a truly
expected, high-frequency condition (a client requesting a nonexistent
resource, a scanner probing for well-known vulnerable paths) should log at
a low severity with no stack trace, while a genuine internal fault should
log at high severity with full context. If every error path shares one
logging call regardless of category, the signal-to-noise ratio degrades
exactly when you need it most — during an actual incident, buried under
routine noise.

### 2.9 Monitoring and alerting philosophy

- **An uptime/liveness monitor must run somewhere other than the system
  being monitored.** A monitor co-located with the thing it watches cannot
  report an outage of the very host it depends on to report anything at
  all.
- **A failure that fails silently is worse than no monitoring at all**,
  because it creates false confidence. Any automated recurring job that
  matters (backups, especially) should alert on its own failure, not just
  log it somewhere no one is watching.
- **Alert routing should distinguish infrastructure/ops concerns from
  application/business concerns**, and should go to whoever is actually
  positioned to act on each. Routing both to the same generic inbox risks
  either category being missed among the other's volume.
- Disk-space and other resource-exhaustion alerts should fire with enough
  lead time to act (e.g., at 70-80% usage), not only once the resource is
  already exhausted.
- **Match the log-visibility tool to the actual question being asked, not
  to what a larger team's stack looks like.** "Let me see what's happening
  right now, across every service, in a browser" is answered by a
  lightweight, stateless, zero-configuration log *viewer* reading directly
  from the container runtime's own logs — no shipping pipeline, no
  aggregation database, no retention policy to design, because it doesn't
  hold its own data at all. "Let me search across weeks of history" or
  "alert me on a pattern in the logs" is a categorically different need,
  answered by a real aggregation stack (a log database plus a
  visualization layer) — genuinely more capability, at the real cost of
  more moving parts, a log-shipping pipeline, and ongoing retention/label
  configuration to maintain. Don't adopt the second tier until you actually
  have the first tier's need (see §5 for the scaling trigger).
- **Internal admin tools (log viewers, dashboards, anything not meant for
  the public) need their own authentication story — decide it deliberately,
  don't default to "reachable only by whoever finds the URL."** Two
  reasonable patterns: gate it at the reverse proxy with HTTP Basic Auth
  (simplest, no external dependency, but a static shared password with no
  per-identity revocation), or — if a CDN/proxy already sits in front of
  the deployment — an edge-level access-control product tied to real
  identities (e.g. email-based one-time codes), which intercepts the
  request *before it ever reaches the origin* and avoids managing a
  password at all. The latter is usually the better trade when it's already
  available for free at your scale, and it composes: once set up once, the
  same identity policy can gate every subsequent internal tool with no new
  auth code anywhere.

### 2.10 Backup and disaster-recovery philosophy

- **Uptime (a service auto-restarting after a crash) is not durability
  (protection against data loss).** A restart policy protects against
  process crashes and reboots; it does nothing for a corrupted volume, a
  mistaken destructive command, or a compromised host. Backups are the
  answer to the second category, and are not optional just because the
  first category is handled.
- **Offsite, not just local.** A backup stored only on the same host it's
  backing up doesn't protect against the loss of that host.
- **Isolate backup write/delete credentials from the application's own
  credentials.** See §2.7.
- **Prefer provider-level retention/lifecycle rules over script-side
  deletion**, where available — this avoids the backup credential ever
  needing delete permission for routine operation, shrinking what a
  compromised host could do even in the worst case.
- **An untested backup is a hypothesis, not a backup.** Periodically prove
  the restore path actually works, ideally into a disposable/throwaway
  target, not just the day you actually need it.
- **True immutability (WORM/object-lock style protections) is a
  meaningfully stronger guarantee than "the token happens to lack delete
  permission today"** — worth adopting once the data being protected
  justifies the extra setup cost, and often needs to be configured at
  creation time for the storage bucket/container it protects, not
  retrofitted later.

### 2.11 Perimeter/edge hardening (CDN, DDoS protection, origin concealment)

- Putting a proxying CDN in front of an origin server can meaningfully
  reduce the blast radius of volumetric attacks and casual scanning,
  because the CDN's network — not your one server — absorbs the traffic
  first.
- **This protection is not automatic just because DNS points at the CDN.**
  If the origin server's own firewall still accepts direct connections from
  anywhere, anyone who already knows (or discovers) the real origin address
  can bypass the CDN entirely. The origin's firewall must be explicitly
  restricted to the CDN's own published IP ranges for this protection to be
  real rather than cosmetic.
- **A container runtime's own port-publishing mechanism can silently bypass
  a host-level firewall.** If applications run inside containers with
  published ports, verify — don't assume — that host-firewall rules
  actually apply to that traffic path. Many container runtimes insert their
  own network rules ahead of (or parallel to) the host firewall's own
  chain, meaning a host-firewall-only restriction can have zero effect on
  container-published ports. The correct enforcement point is often a
  runtime-specific hook chain designed for exactly this purpose, not the
  host firewall's generic input chain.
- **When verifying a perimeter restriction, test from a genuinely external
  vantage point, never from behind the perimeter you're testing.** A host
  connecting to its own public address can take an entirely different
  internal network path than real external traffic (a "hairpin" path),
  which can make a correctly-configured restriction appear broken, or
  (worse) make a broken restriction appear to be working. Only a test
  originating from truly outside the perimeter is meaningful evidence
  either way.
- **A firewall rule written purely on destination port, without a direction
  or interface scope, restricts more than you think.** The kernel-level hook
  chain used to filter traffic *to* published container ports (see above) is
  frequently the *same* chain consulted for traffic a container sends *out*
  to the internet — because both are "forwarded" traffic from the runtime's
  perspective, not "traffic destined for the host itself." A rule meant to
  say "only the CDN may reach port 443" but written as "drop anything on
  port 443 not from the CDN" will also silently drop a container's own
  outbound calls to any third-party HTTPS API (a payment provider, an email
  service, anything) — because those calls also use port 443 and obviously
  don't originate from the CDN's ranges. The fix is to scope the rule by
  **network interface** (or an equivalent direction indicator on your
  platform), not port alone: restrictive rules should only ever evaluate
  traffic arriving via the host's external interface, never traffic arriving
  via a container-network interface (which is what outbound traffic looks
  like at this chain, right up until it's routed out). Confirm the real
  external interface name directly (e.g. `ip route get <public-ip>`) rather
  than assuming a conventional name.
- **After any perimeter/firewall change, verify every direction it could
  plausibly affect, not only the one you intended to restrict.** Testing
  "is the thing I meant to block, blocked?" is necessary but not
  sufficient — a rule can simultaneously succeed at the restriction you
  wanted and silently break something you didn't intend to touch at all
  (see the example above). The two failure modes often look nothing alike
  (a network-level probe vs. a delayed, unrelated-looking application
  error), which is exactly why the collateral damage tends to go unnoticed
  until something downstream — an email, a payment — quietly stops working.

---

## 3. Security hardening principles

1. **Disable password authentication wherever a stronger factor (key-based,
   certificate-based) is available.** For SSH specifically, also disable
   direct root login — require an unprivileged account plus explicit
   privilege escalation, so every privileged action is attributable and
   auditable.
2. **Default-deny inbound at the firewall, then explicitly allow only what
   must be reachable.** Don't start from "allow everything, then block bad
   things" — the reverse is far more resilient to something being forgotten.
3. **Automate security patching**, but treat automatic *reboots* as a
   separate, more deliberate decision — especially for stateful services
   like a database, where an unattended, unobserved restart carries more
   risk than an unattended, unobserved patch install.
4. **Apply least privilege at every credential boundary**: application
   database users should never be the database superuser; a CI deploy
   credential should be able to do only the one deploy action it exists
   for; a backup credential should not double as an application credential.
5. **Never expose a data store (database, cache, message queue) directly to
   the public internet.** Keep it reachable only from the application tier
   that needs it, over a private network; provide operator/GUI access via a
   tunnel (SSH or equivalent) rather than a public port.
6. **Treat any drop-in/override configuration mechanism's precedence rules
   as something to verify, not assume.** Many systems (SSH, logging, package
   configuration) support layered config files where the *load order*
   determines which value wins, and it is not always "last wins" — verify
   the actual effective configuration after any change, don't just trust
   that the change you made is the one in effect.
7. **Set explicit, restrictive values for anything with a documented
   "insecure by default if unconfigured" fallback** (a classic example:
   permissive CORS wildcards that only activate when a stricter allow-list
   is left unset). Read your own application's configuration code for these
   fallback behaviors rather than assuming "it worked before" means it's
   safe.
8. **Reduce noise at the edge, not just at the application.** Blocking
   obviously-malicious or irrelevant request patterns (common scanner
   paths, for instance) at the reverse-proxy/edge layer, before they reach
   application code, both reduces resource consumption and keeps
   application logs focused on signal.
9. **Verify perimeter changes from outside the perimeter.** See §2.11.
10. **Rotate any credential that was ever exposed outside its intended
    storage location**, and understand each credential's blast radius
    *before* rotating it (e.g., rotating an auth-token-signing secret
    typically invalidates every existing session — schedule that rotation
    deliberately, not reflexively).

---

## 4. Common mistakes and pitfalls

- **Trusting the host firewall alone to restrict access to
  container-published ports.** Many container runtimes bypass or
  parallel the host firewall's normal chain for published ports. Verify the
  actual enforcement point for your specific runtime rather than assuming
  a host-firewall rule is sufficient.
- **Testing a perimeter restriction from behind that same perimeter.**
  Self-to-self connections frequently take a different internal path than
  genuine external traffic and can produce misleading test results in
  either direction.
- **Writing a container-runtime firewall rule on port alone, with no
  direction/interface scope.** The chain used to restrict inbound access to
  a published port is frequently the same chain consulted for a container's
  own outbound traffic. A rule meant to restrict who can *reach* port 443
  can silently also block your own services from *calling out* on port 443
  (a payment API, an email provider) — and because the two failures look
  completely different (a network probe vs. a delayed application error),
  the collateral damage can go unnoticed for a while. Scope by interface,
  and test both directions after the change, every time.
- **Assuming a copy-pasted fix (from a forum, an AI assistant, a
  colleague's unrelated project) matches your actual configuration.**
  Verify its stated root cause against your own observed state before
  applying its prescribed fix — a fix for a different underlying
  architecture (e.g., a different container networking mode) can be
  entirely inapplicable, even when it looks superficially relevant.
- **Using a database's "latest" image tag in production.** Major version
  bumps frequently change on-disk data formats; an unpinned tag risks an
  unplanned, breaking upgrade on a routine re-pull. Pin at least the major
  version.
- **Generating a password with a character set that isn't safe for its
  destination.** A password destined for a URL/connection-string should be
  generated with a URL-safe character set from the start, not discovered to
  be a problem after a confusing connection failure.
- **Assuming a migrated/self-hosted environment has the same implicit
  features a previous managed provider silently supplied** (extensions,
  default configuration, generous limits). Audit explicitly rather than
  discovering gaps as production failures.
- **Logging routine, expected conditions at the same severity as genuine
  faults.** This buries real signal during an actual incident and can waste
  meaningful disk space over time on a busy public-facing service.
- **Treating "it deployed successfully once" as equivalent to "the
  deployment pipeline is reliable," or "it backed up successfully once" as
  equivalent to "backups are reliable."** Both need to be observed
  succeeding unattended, repeatedly, over real time, before being trusted as
  a genuine safety net — and both need their *failure* path tested too (does
  a broken deploy actually fail loudly? does a broken backup actually
  alert?).
- **Deferring backups until "after the important stuff is built."** A
  production system without a verified backup and restore path should be
  considered incomplete, not merely unpolished — this is not a nice-to-have
  added later, it's a prerequisite before real, irreplaceable data exists in
  the system.
- **Over-provisioning orchestration complexity (e.g., adopting Kubernetes)
  ahead of actual scale or team-size need.** The operational cost is real
  and ongoing; it should be adopted in response to an actual constraint, not
  speculative future scale.
- **Assuming a resource constraint (like CI/CD minutes) applies without
  checking.** Verify actual platform limits for your specific plan/repo
  visibility before optimizing around an assumed constraint that may not
  exist.

---

## 5. Scaling strategy and when architecture should change

Treat each of these as a **trigger to reconsider**, not a fixed timeline:

- **Single shared database instance → dedicated instance per
  application:** when one application's load, blast radius, or maintenance
  needs start meaningfully affecting others sharing the instance.
- **Manual connection limits → connection pooler (e.g., PgBouncer or
  equivalent):** when raising a database's max-connections setting directly
  is being used as a workaround for an actual concurrency need, rather than
  addressing the underlying connection-per-request pattern.
- **Single VPS + Compose → multiple hosts / orchestration platform:** when
  you need automated failover, horizontal scaling beyond one host's
  capacity, or zero-downtime rolling deploys across more instances than can
  be reasoned about manually.
- **Environment-file secrets → a dedicated secrets manager:** when the
  number of environments, services, or operators makes manual `.env` file
  management itself a source of drift or error.
- **Ad hoc alert scripts → a dedicated observability platform:** when the
  number of signals worth tracking outgrows a handful of threshold-based
  email alerts, or when correlating multiple signals during an incident
  becomes valuable (centralized logs, tracing, dashboards).
- **Lightweight log viewer → real log aggregation:** when "watch it live in
  a browser" stops being enough and you actually need to search *across
  time* (last week's incident, not just right now) or alert on a pattern
  within the logs themselves, rather than a simple external threshold. This
  is a good example of a low-risk, additive upgrade — the viewer tier
  requires no migration away from, since it reads the same underlying logs
  the aggregation stack would also ingest.
- **Best-effort backup retention → immutable/WORM backups:** once the data
  being protected justifies stronger guarantees than "the current credential
  happens to lack delete permission."
- **CDN proxy present but origin firewall unrestricted → origin firewall
  locked to the CDN's ranges:** this should really happen at the same time
  as adopting the CDN, not later — see §2.11.

---

## 6. Reusable operational checklists

### 6.1 Initial server setup

- [ ] Generate a key pair on the operator's own machine before touching the
      server.
- [ ] Log in, apply OS updates, set a sane timezone for consistent log
      timestamps.
- [ ] Create a named, unprivileged administrative user; install the SSH
      public key for that user.
- [ ] Verify the new user can log in *and* escalate privileges correctly
      **before** closing the initial root/default session.
- [ ] Disable root login and password authentication over SSH; verify the
      *effective* configuration afterward (not just the file you edited),
      accounting for any layered/drop-in config precedence rules.
- [ ] Configure a default-deny firewall, explicitly allowing only what must
      be reachable at this stage (typically just SSH).
- [ ] Install brute-force protection for exposed authentication surfaces.
- [ ] Enable automatic security patching; make an explicit, deliberate
      decision about automatic reboots (generally: off for anything
      stateful).
- [ ] Check available swap; add a safety-net swap file if the host has
      modest RAM and will run memory-sensitive services.
- [ ] Install the container runtime from its official source, not a
      possibly-outdated distro package.

### 6.2 Pre-production (before real traffic or real data)

- [ ] Data store is network-isolated (no public exposure), tuned
      appropriately for the host's actual available resources, and using a
      pinned (not "latest") version tag if it has meaningful major-version
      upgrade risk.
- [ ] Least-privilege database credentials exist for the application; no
      application connects as a superuser/root database role.
- [ ] A build pipeline reliably produces a deployable artifact, tagged both
      mutably (for routine deploys) and immutably (for rollback).
- [ ] At least one deployment has been performed and verified manually
      before any automation triggers it.
- [ ] Secrets are confirmed absent from source control and from the build
      artifact itself.
- [ ] An offsite backup exists, using credentials isolated from the
      application's own, and **the restore path has been tested at least
      once.**
- [ ] An external uptime/liveness monitor is configured and confirmed to
      actually alert (not just configured — verified to fire).
- [ ] Any automated recurring job that matters (backups especially) alerts
      on its own failure.
- [ ] Log rotation is configured for every log-producing system
      independently (container runtime logs, script/cron logs, and
      confirmation that system/package logs are already handled).
- [ ] CORS (or equivalent cross-origin trust configuration) is explicitly
      set, with any "insecure if unconfigured" fallback in the application
      confirmed closed.

### 6.3 Deployment

- [ ] Build succeeds and the artifact is published before any deploy
      trigger runs.
- [ ] Deploy trigger uses a credential scoped to only the deploy action.
- [ ] Deploy logic lives in an inspectable, independently-runnable script,
      not buried only inside CI configuration.
- [ ] Deploy output is logged persistently, not only visible in the CI UI
      at the time it ran.
- [ ] A rollback path (redeploying a specific prior immutable tag) is
      documented and has been exercised at least once, not only theorized.

### 6.4 Routine maintenance

- [ ] Periodically verify backups are still succeeding (check the alert
      channel has been quiet for the right reason, not because alerting
      itself broke).
- [ ] Periodically perform an actual test restore into a disposable target.
- [ ] Periodically review disk usage trends, not just the current
      threshold-alert state.
- [ ] Periodically confirm any external IP allow-lists (e.g., a CDN
      provider's published ranges) are still current.
- [ ] Periodically review and apply pending OS/package updates not covered
      by automatic patching (e.g., anything requiring a manual reboot
      review).
- [ ] Periodically reconsider whether any "deferred for later" hardening
      item (see the project's own operations manual, §8-equivalent) is now
      due, given how the system's scale or risk profile has changed.

### 6.5 Incident response

- [ ] Confirm the alert is real (check the monitoring source directly, not
      just the notification) before taking action.
- [ ] Check service health status at each layer, outside-in (edge/proxy →
      application → data store), to localize where the failure actually is.
- [ ] Consult the relevant log source for the layer where the failure
      localizes; check timestamps against when the alert fired to correlate.
- [ ] If the fix involves a firewall/network change, verify it from a
      genuinely external vantage point, not from the host itself.
- [ ] If the fix involves a rollback, use the documented immutable-tag
      rollback path rather than improvising.
- [ ] After resolution, record symptom → root cause → fix → prevention
      somewhere durable (the project's own operations manual), even if the
      fix was quick — the pattern is what has lasting value, not just the
      immediate resolution.

### 6.6 Disaster recovery

- [ ] Confirm the scope of loss (which data store, which point in time is
      the most recent viable backup).
- [ ] Restore into a **separate, disposable target first** if at all
      possible, to verify the backup is actually viable before committing
      to overwriting the live system.
- [ ] Stop write traffic to the affected data store before performing a
      destructive restore (drop/recreate) against it.
- [ ] Re-verify any environment-specific setup the restored data might
      depend on (extensions, roles/ownership, connection strings) rather
      than assuming a restore is purely a data operation.
- [ ] Confirm the application reconnects and serves correctly against the
      restored data before considering the incident closed.
- [ ] Only after the above is confirmed stable, consider whether any
      previous/fallback infrastructure can now be safely decommissioned —
      and not sooner.
