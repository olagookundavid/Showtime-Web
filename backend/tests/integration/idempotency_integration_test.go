package tests_integration

// Integration coverage for the Idempotency-Key store (migration 134): one claim
// per key under concurrency, replay of a stored response, release of a failed
// claim, takeover of an abandoned claim only for the same request, and purge.
//
// Keys belong to wallet fixture users (*@walletfixture.test) and go with them
// (ON DELETE CASCADE). Skipped when TEST_DB_DSN is unset.

import (
	"context"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"showtime-backend/internal/ports"
)

const idemScope = "POST /api/v1/zzfix/checkout"

func TestIdempotency_ConcurrentClaimOfOneKeyHasOneWinner(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	repo := ports.NewIdempotencyRepository(f.pool)
	u := f.user(t, "ZZFIXidem")

	var claimed, running int32
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			rec, ok, err := repo.Claim(ctx, u, idemScope, "key-race", "hash-a", time.Minute)
			if err != nil {
				t.Errorf("claim: %v", err)
				return
			}
			if ok {
				atomic.AddInt32(&claimed, 1)
				return
			}
			if rec == nil || rec.StatusCode != nil || rec.RequestHash != "hash-a" {
				t.Errorf("a losing claim should see the running record, got %+v", rec)
				return
			}
			atomic.AddInt32(&running, 1)
		}()
	}
	wg.Wait()
	if claimed != 1 || running != 19 {
		t.Fatalf("claimed=%d running=%d, want 1 and 19", claimed, running)
	}

	// The same key for another user or another route is a different key.
	other := f.user(t, "ZZFIXidem2")
	if _, ok, err := repo.Claim(ctx, other, idemScope, "key-race", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("another user's key: ok=%v err=%v", ok, err)
	}
	if _, ok, err := repo.Claim(ctx, u, "POST /api/v1/zzfix/other", "key-race", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("another scope's key: ok=%v err=%v", ok, err)
	}
}

func TestIdempotency_CompleteThenClaimReplaysTheStoredResponse(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	repo := ports.NewIdempotencyRepository(f.pool)
	u := f.user(t, "ZZFIXidem")

	if _, ok, err := repo.Claim(ctx, u, idemScope, "key-done", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("first claim: ok=%v err=%v", ok, err)
	}
	body := []byte(`{"ticket_code":"ZZFIX-1"}`)
	if err := repo.Complete(ctx, u, idemScope, "key-done", 201, body, "application/json"); err != nil {
		t.Fatal(err)
	}

	rec, ok, err := repo.Claim(ctx, u, idemScope, "key-done", "hash-a", time.Minute)
	if err != nil || ok {
		t.Fatalf("claim after complete: ok=%v err=%v", ok, err)
	}
	if rec == nil || rec.StatusCode == nil || *rec.StatusCode != 201 || string(rec.Body) != string(body) ||
		rec.ContentType != "application/json" || rec.RequestHash != "hash-a" {
		t.Fatalf("unexpected stored record: %+v", rec)
	}

	// A completed key is never taken over, even long after its lease, and Release
	// does not drop it.
	mustExec(t, f.pool, `UPDATE idempotency_keys SET locked_until = NOW() - INTERVAL '1 hour' WHERE user_id = $1 AND key = 'key-done'`, u)
	if _, ok, _ := repo.Claim(ctx, u, idemScope, "key-done", "hash-a", time.Minute); ok {
		t.Fatal("a completed key was claimed again")
	}
	if err := repo.Release(ctx, u, idemScope, "key-done"); err != nil {
		t.Fatal(err)
	}
	if rec, ok, _ := repo.Claim(ctx, u, idemScope, "key-done", "hash-a", time.Minute); ok || rec == nil || rec.StatusCode == nil {
		t.Fatalf("Release removed a completed key: ok=%v rec=%+v", ok, rec)
	}
}

func TestIdempotency_ReleaseFreesARunningClaim(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	repo := ports.NewIdempotencyRepository(f.pool)
	u := f.user(t, "ZZFIXidem")

	if _, ok, err := repo.Claim(ctx, u, idemScope, "key-rel", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("first claim: ok=%v err=%v", ok, err)
	}
	if _, ok, _ := repo.Claim(ctx, u, idemScope, "key-rel", "hash-a", time.Minute); ok {
		t.Fatal("a running claim was taken twice")
	}
	if err := repo.Release(ctx, u, idemScope, "key-rel"); err != nil {
		t.Fatal(err)
	}
	if _, ok, err := repo.Claim(ctx, u, idemScope, "key-rel", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("claim after release: ok=%v err=%v", ok, err)
	}
}

func TestIdempotency_ExpiredClaimIsTakenOverOnlyByTheSameRequest(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	repo := ports.NewIdempotencyRepository(f.pool)
	u := f.user(t, "ZZFIXidem")

	if _, ok, err := repo.Claim(ctx, u, idemScope, "key-exp", "hash-a", time.Minute); err != nil || !ok {
		t.Fatalf("first claim: ok=%v err=%v", ok, err)
	}
	// Still within its lease: nobody can take it.
	if _, ok, _ := repo.Claim(ctx, u, idemScope, "key-exp", "hash-a", time.Minute); ok {
		t.Fatal("a live claim was taken over")
	}
	// The server died mid-request: the lease runs out.
	mustExec(t, f.pool, `UPDATE idempotency_keys SET locked_until = NOW() - INTERVAL '1 second' WHERE user_id = $1 AND key = 'key-exp'`, u)

	// A different request reusing the key is refused and sees the original hash.
	rec, ok, err := repo.Claim(ctx, u, idemScope, "key-exp", "hash-b", time.Minute)
	if err != nil || ok {
		t.Fatalf("different request: ok=%v err=%v", ok, err)
	}
	if rec == nil || rec.RequestHash != "hash-a" || rec.StatusCode != nil {
		t.Fatalf("unexpected record: %+v", rec)
	}

	// The same request retrying takes it over, once, even when retries race.
	var took int32
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, ok, err := repo.Claim(ctx, u, idemScope, "key-exp", "hash-a", time.Minute)
			if err != nil {
				t.Errorf("takeover: %v", err)
			}
			if ok {
				atomic.AddInt32(&took, 1)
			}
		}()
	}
	wg.Wait()
	if took != 1 {
		t.Fatalf("expired claim taken over %d times, want 1", took)
	}
	if live := mustScan(t, f.pool, `SELECT (locked_until > NOW())::text FROM idempotency_keys WHERE user_id = $1 AND key = 'key-exp'`, u); live != "true" {
		t.Fatal("the takeover did not renew the lease")
	}
}

func TestIdempotency_PurgeRemovesOnlyOldKeys(t *testing.T) {
	f := newWalletFixture(t)
	ctx := context.Background()
	repo := ports.NewIdempotencyRepository(f.pool)
	u := f.user(t, "ZZFIXidem")

	for _, k := range []string{"key-old", "key-new"} {
		if _, ok, err := repo.Claim(ctx, u, idemScope, k, "hash-a", time.Minute); err != nil || !ok {
			t.Fatalf("claim %s: ok=%v err=%v", k, ok, err)
		}
	}
	mustExec(t, f.pool, `UPDATE idempotency_keys SET created_at = NOW() - INTERVAL '72 hours' WHERE user_id = $1 AND key = 'key-old'`, u)

	// 48h, longer than production's one day, so a shared database loses nothing
	// it would not have lost anyway.
	if err := repo.Purge(ctx, 48*time.Hour); err != nil {
		t.Fatal(err)
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM idempotency_keys WHERE user_id = $1 AND key = 'key-old'`, u); n != "0" {
		t.Fatal("an old key survived the purge")
	}
	if n := mustScan(t, f.pool, `SELECT COUNT(*)::text FROM idempotency_keys WHERE user_id = $1 AND key = 'key-new'`, u); n != "1" {
		t.Fatal("a fresh key was purged")
	}
	// Once purged, the key is free again.
	if _, ok, err := repo.Claim(ctx, u, idemScope, "key-old", "hash-z", time.Minute); err != nil || !ok {
		t.Fatalf("claim after purge: ok=%v err=%v", ok, err)
	}
}
