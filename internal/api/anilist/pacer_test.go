package anilist

import (
	"context"
	"net/http"
	"sync"
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
		_, err := p.Wait(context.Background(), func(ctx context.Context, d time.Duration) error {
			<-ctx.Done()
			return ctx.Err()
		})
		done <- err
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

func blockUntilCancelled(ctx context.Context, d time.Duration) error {
	<-ctx.Done()
	return ctx.Err()
}

func waitForWaiters(t *testing.T, p *aniListPacer, n int) {
	t.Helper()
	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		p.mu.Lock()
		got := len(p.waiting)
		p.mu.Unlock()
		if got == n {
			return
		}
		time.Sleep(time.Millisecond)
	}
	t.Fatalf("expected %d waiting requests", n)
}

func TestAniListPacerCancelledWaitGivesSlotBack(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"25"}})
	interval := time.Minute / 90

	// The first paced request goes right away
	if _, err := p.Wait(context.Background(), blockUntilCancelled); err != nil {
		t.Fatal(err)
	}

	// The rest queue up, then the page is left and they are all cancelled
	ctx, cancel := context.WithCancel(context.Background())
	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if _, err := p.Wait(ctx, blockUntilCancelled); err == nil {
				t.Error("cancelled wait should return an error")
			}
		}()
	}
	waitForWaiters(t, p, 10)
	cancel()
	wg.Wait()

	if len(p.pending) != 1 {
		t.Fatalf("cancelled requests should not stay pending, got %d", len(p.pending))
	}
	// The next request only queues behind the one that was really sent
	if d := p.delay(); d != interval {
		t.Fatalf("expected %s wait after cancelled requests, got %s", interval, d)
	}
}

func TestAniListPacerCancelledMiddleKeepsLaterSlots(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"25"}})
	p.delay()

	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() {
		p.Wait(ctx, blockUntilCancelled)
		close(done)
	}()
	waitForWaiters(t, p, 1)
	go p.Wait(context.Background(), blockUntilCancelled)
	waitForWaiters(t, p, 2)
	p.mu.Lock()
	next := p.next
	p.mu.Unlock()

	// A later request is still waiting, so its slot stays where it is
	cancel()
	<-done
	p.mu.Lock()
	defer p.mu.Unlock()
	if !p.next.Equal(next) {
		t.Fatalf("queue end moved from %s to %s while a later request still waits", next, p.next)
	}
}

func TestAniListPacerReleaseFailedRequest(t *testing.T) {
	p := newAniListPacer()
	release, err := p.Wait(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	other, _ := p.Wait(context.Background(), nil)
	release()
	release()
	if len(p.pending) != 1 {
		t.Fatalf("a failed request should drop only its own pending entry, got %d left", len(p.pending))
	}

	// The response for a later request took the oldest entry, so releasing drops the one left
	p.Wait(context.Background(), nil)
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"80"}})
	other()
	if len(p.pending) != 0 {
		t.Fatalf("expected no pending requests, got %d", len(p.pending))
	}
}

func TestAniListPacerBurstStaysPaced(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"45"}})
	for i := 0; i < 20; i++ {
		p.delay()
	}
	if p.next.IsZero() {
		t.Fatal("the end of the burst should be paced")
	}
	recovered := p.recovered

	// The first response of the burst is not a window reset
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"44"}})
	if p.next.IsZero() {
		t.Fatal("the first response of a burst should not drop the queue")
	}
	select {
	case <-recovered:
		t.Fatal("the first response of a burst should not release waiting requests")
	default:
	}

	// A real reset does, even with the rest of the burst still on its way
	p.Observe(http.Header{"X-Ratelimit-Limit": {"90"}, "X-Ratelimit-Remaining": {"89"}})
	if !p.next.IsZero() {
		t.Fatal("queue should be cleared when the window resets")
	}
	select {
	case <-recovered:
	default:
		t.Fatal("waiting requests should be released when the window resets")
	}
}

func TestAniListPacerHeaderlessResponseClearsPending(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }

	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"20"}})
	p.delay()
	p.delay()
	// An error page without rate-limit headers still answers a request
	p.Observe(http.Header{})
	p.Observe(nil)
	if len(p.pending) != 0 {
		t.Fatalf("responses without budget headers should still clear pending, %d left", len(p.pending))
	}
}

func TestAniListPacerQueuedRequestsDontBlockRecovery(t *testing.T) {
	now := time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC)
	p := newAniListPacer()
	p.now = func() time.Time { return now }

	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"2"}})
	// One request goes now, many more queue for their slots without being sent
	p.delay()
	for i := 0; i < 25; i++ {
		p.delay()
	}
	// The window resets: only the one sent request is in flight
	p.Observe(http.Header{"X-Ratelimit-Limit": {"30"}, "X-Ratelimit-Remaining": {"29"}})
	if !p.next.IsZero() {
		t.Fatal("queued requests that were never sent should not hold back recovery")
	}
}
