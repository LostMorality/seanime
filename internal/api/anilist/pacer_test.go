package anilist

import (
	"context"
	"net/http"
	"testing"
	"time"
)

func TestAniListPacer(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }

	if d := p.delay(); d != 0 {
		t.Fatalf("no budget reported yet: expected no wait, got %s", d)
	}

	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"60"}})
	if d := p.delay(); d != 0 {
		t.Fatalf("plenty left: expected no wait, got %s", d)
	}

	// Under a third left: requests are spaced a window/limit apart
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"20"}})
	interval := time.Minute / 90
	if d := p.delay(); d != 0 {
		t.Fatalf("first paced request goes right away, got %s", d)
	}
	if d := p.delay(); d != interval {
		t.Fatalf("second paced request: expected %s, got %s", interval, d)
	}
	if d := p.delay(); d != 2*interval {
		t.Fatalf("third paced request: expected %s, got %s", 2*interval, d)
	}

	// Almost out: slower still
	p.next = time.Time{}
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"2"}})
	p.delay()
	if d := p.delay(); d != 3*(time.Minute/30) {
		t.Fatalf("nearly out: expected %s, got %s", 3*(time.Minute/30), d)
	}

	// The budget resets: the queue is dropped and waiting requests are let go
	p.next = time.Time{}
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"2"}})
	p.delay()
	done := make(chan error, 1)
	go func() {
		done <- p.Wait(context.Background(), func(ctx context.Context, d time.Duration) error {
			<-ctx.Done()
			return ctx.Err()
		})
	}()
	time.Sleep(20 * time.Millisecond)
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"29"}})
	select {
	case err := <-done:
		if err != nil {
			t.Fatalf("waiting request should go once the budget recovers, got %v", err)
		}
	case <-time.After(time.Second):
		t.Fatal("waiting request was not released when the budget recovered")
	}
	if !p.next.IsZero() {
		t.Fatal("queue should be cleared when the budget recovers")
	}

	// A response doesn't make the pacer forget requests still on their way
	p = newAniListPacer()
	p.now = func() time.Time { return now }
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"12"}})
	for i := 0; i < 8; i++ {
		p.delay()
	}
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"11"}})
	// 11 reported but 7 still on their way, so only 4 are really left
	p.delay()
	start := p.next
	p.delay()
	if gap := p.next.Sub(start); gap != 3*(time.Minute/30) {
		t.Fatalf("with in-flight requests counted the budget is nearly out: expected %s gap, got %s", 3*(time.Minute/30), gap)
	}

	// Old information is ignored once the window has passed
	now = now.Add(2 * time.Minute)
	if d := p.delay(); d != 0 {
		t.Fatalf("stale budget: expected no wait, got %s", d)
	}
}
