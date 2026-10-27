package anilist

import (
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

	// Old information is ignored once the window has passed
	now = now.Add(2 * time.Minute)
	if d := p.delay(); d != 0 {
		t.Fatalf("stale budget: expected no wait, got %s", d)
	}
}
