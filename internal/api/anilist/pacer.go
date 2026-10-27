package anilist

import (
	"context"
	"net/http"
	"strconv"
	"sync"
	"time"
)

// aniListPacer spreads requests out once AniList reports that the per-minute budget is running low.
// Without it, quickly switching pages spends the whole budget in a burst, gets a 429,
// and then everything waits for the window to reset. Slowing down a little before that happens
// keeps pages loading instead.
type aniListPacer struct {
	mu        sync.Mutex
	limit     int
	remaining int
	updatedAt time.Time
	next      time.Time
	// Requests sent since the last reported budget, which that budget doesn't include yet
	pending []time.Time
	now     func() time.Time
	// Closed when the budget recovers, so requests already waiting for a slot go right away
	recovered chan struct{}
}

const (
	aniListRateWindow = time.Minute
	// Pacing starts once fewer than this fraction of the budget is left
	aniListPaceBelowFraction = 3
	// A request with no response after this long is assumed to have failed
	aniListPendingTTL = 30 * time.Second
	// How long a reported budget is trusted before it is considered reset
	aniListPaceInfoTTL = aniListRateWindow
)

var sharedAniListPacer = newAniListPacer()

func newAniListPacer() *aniListPacer {
	return &aniListPacer{now: time.Now, recovered: make(chan struct{})}
}

// delay reserves a slot for the next request and returns how long to wait for it.
func (p *aniListPacer) delay() time.Duration {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := p.now()
	p.dropExpiredPending(now)
	pending := len(p.pending)
	p.pending = append(p.pending, now)
	if p.limit <= 0 || p.updatedAt.IsZero() || now.Sub(p.updatedAt) > aniListPaceInfoTTL {
		return 0
	}

	// Count requests that are on their way, so a burst is paced before the responses come back
	remaining := p.remaining - pending

	if remaining > p.limit/aniListPaceBelowFraction {
		return 0
	}

	interval := aniListRateWindow / time.Duration(p.limit)
	// Almost out: slow down further so the last few requests don't trigger a full block
	if remaining <= 3 {
		interval *= 3
	}

	slot := p.next
	if slot.Before(now) {
		slot = now
	}
	p.next = slot.Add(interval)
	return slot.Sub(now)
}

func (p *aniListPacer) Wait(ctx context.Context, sleep requestSleepFunc) error {
	if sleep == nil {
		sleep = sleepWithContext
	}
	p.mu.Lock()
	recovered := p.recovered
	p.mu.Unlock()

	d := p.delay()
	if d <= 0 {
		return nil
	}
	sleepCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	go func() {
		select {
		case <-recovered:
			cancel()
		case <-sleepCtx.Done():
		}
	}()
	if err := sleep(sleepCtx, d); err != nil && ctx.Err() != nil {
		return err
	}
	return nil
}

// Observe records the budget AniList reported in a response.
func (p *aniListPacer) Observe(headers http.Header) {
	if headers == nil {
		return
	}
	remaining, err := strconv.Atoi(headers.Get("X-Ratelimit-Remaining"))
	if err != nil {
		return
	}
	limit, err := strconv.Atoi(headers.Get("X-Ratelimit-Limit"))
	if err != nil || limit <= 0 {
		limit = 90
	}

	p.mu.Lock()
	defer p.mu.Unlock()
	// This response accounts for the oldest request still on its way
	if len(p.pending) > 0 {
		p.pending = p.pending[1:]
	}
	p.limit = limit
	p.remaining = remaining
	p.updatedAt = p.now()

	// The window reset: drop the queue built up while the budget was low
	if remaining > limit/aniListPaceBelowFraction && !p.next.IsZero() {
		p.next = time.Time{}
		close(p.recovered)
		p.recovered = make(chan struct{})
	}
}

func (p *aniListPacer) dropExpiredPending(now time.Time) {
	i := 0
	for i < len(p.pending) && now.Sub(p.pending[i]) > aniListPendingTTL {
		i++
	}
	p.pending = p.pending[i:]
}

// WaitForAniListSlot lets AniList requests made outside this package (plugin fetches)
// respect the same rate-limit block and pacing as the server's own requests.
func WaitForAniListSlot(ctx context.Context) error {
	if err := sharedAniListRateBlocker.Wait(ctx, sleepWithContext); err != nil {
		return err
	}
	return sharedAniListPacer.Wait(ctx, sleepWithContext)
}

// ObserveAniListResponse feeds a response from outside this package back into the shared pacing,
// and blocks further requests until the reset time when it was rate limited.
func ObserveAniListResponse(statusCode int, headers http.Header) {
	sharedAniListPacer.Observe(headers)
	if statusCode != http.StatusTooManyRequests {
		return
	}
	responseTime := time.Now()
	if parsed, ok := parseResponseDate(headers); ok {
		responseTime = parsed
	}
	resetAt, ok := parseRateLimitResetTime(headers, responseTime)
	if !ok {
		resetAt = responseTime.Add(aniListRateWindow)
	}
	if sharedAniListRateBlocker.BlockUntil(resetAt) {
		waitSeconds := int(resetAt.Sub(responseTime).Round(time.Second) / time.Second)
		if waitSeconds < 1 {
			waitSeconds = 1
		}
		notifyAniListRateLimit(nil, waitSeconds)
	}
}
