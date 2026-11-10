package email

import (
	"errors"
	"sync"
	"testing"
	"time"

	"github.com/resend/resend-go/v3"
)

// fakeClock lets the pacer's waits be counted instead of slept.
type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) Sleep(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

func TestPacerSpacesSendsUnderResendsLimit(t *testing.T) {
	p := &sendPacer{}
	clock := &fakeClock{now: time.Unix(0, 0)}
	start := clock.Now()
	for i := 0; i < 30; i++ {
		p.wait(sendInterval, clock.Now, clock.Sleep)
	}
	// 30 sends at 8 a second take at least 29 intervals.
	if got, want := clock.Now().Sub(start), 29*sendInterval; got < want {
		t.Errorf("30 sends took %v, want at least %v", got, want)
	}
	if per := time.Second / sendInterval; per >= 10 {
		t.Errorf("pacing allows %d a second, Resend allows 10", per)
	}
}

func TestSendPacedRetriesOnlyRateLimits(t *testing.T) {
	clock := &fakeClock{now: time.Unix(0, 0)}
	pacer = &sendPacer{}

	calls := 0
	err := sendPaced(func() error {
		calls++
		if calls < 3 {
			return &resend.RateLimitError{Message: "slow down"}
		}
		return nil
	}, clock.Now, clock.Sleep)
	if err != nil || calls != 3 {
		t.Errorf("rate limited twice then sent: err=%v calls=%d, want nil and 3", err, calls)
	}

	calls = 0
	boom := errors.New("bad address")
	if err := sendPaced(func() error { calls++; return boom }, clock.Now, clock.Sleep); !errors.Is(err, boom) || calls != 1 {
		t.Errorf("other errors are not retried: err=%v calls=%d", err, calls)
	}

	calls = 0
	err = sendPaced(func() error { calls++; return &resend.RateLimitError{} }, clock.Now, clock.Sleep)
	if !errors.Is(err, resend.ErrRateLimit) || calls != rateLimitRetries+1 {
		t.Errorf("always limited: err=%v calls=%d, want the limit error after %d tries", err, calls, rateLimitRetries+1)
	}
}
