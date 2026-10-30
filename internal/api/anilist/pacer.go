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
	pending []aniListPendingRequest
	// Requests sleeping until their slot, so a cancelled one can give its slot back
	waiting []aniListReservation
	// End of the latest slot used by a request that was actually sent
	sentUntil time.Time
	lastID    uint64
	now       func() time.Time
	// Closed when the budget recovers, so requests already waiting for a slot go right away
	recovered chan struct{}
}

type aniListPendingRequest struct {
	id uint64
	at time.Time
}

type aniListReservation struct {
	id  uint64
	end time.Time
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
	d, _, _ := p.reserve()
	return d
}

// reserve reserves a slot for the next request and returns how long to wait for it, plus the request's id and time.
func (p *aniListPacer) reserve() (time.Duration, uint64, time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()

	now := p.now()
	p.dropExpiredPending(now)
	pending := len(p.pending)
	p.lastID++
	id := p.lastID
	p.pending = append(p.pending, aniListPendingRequest{id: id, at: now})
	if p.limit <= 0 || p.updatedAt.IsZero() || now.Sub(p.updatedAt) > aniListPaceInfoTTL {
		return 0, id, now
	}

	// Count requests that are on their way, so a burst is paced before the responses come back
	remaining := p.remaining - pending

	if remaining > p.limit/aniListPaceBelowFraction {
		return 0, id, now
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
	if !slot.After(now) {
		p.sentUntil = p.next
		return 0, id, now
	}
	p.waiting = append(p.waiting, aniListReservation{id: id, end: p.next})
	return slot.Sub(now), id, now
}

// Wait waits for a slot. When it returns nil, the caller must either report the response to Observe
// or call release if no response came back.
func (p *aniListPacer) Wait(ctx context.Context, sleep requestSleepFunc) (release func(), err error) {
	if sleep == nil {
		sleep = sleepWithContext
	}
	p.mu.Lock()
	recovered := p.recovered
	p.mu.Unlock()

	d, id, at := p.reserve()
	released := false
	release = func() {
		if !released {
			released = true
			p.forget(id, at)
		}
	}
	if d <= 0 {
		return release, nil
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
		p.cancelSlot(id)
		release()
		return nil, err
	}
	p.slotUsed(id)
	return release, nil
}

// forget drops the pending entry of a request that got no response.
func (p *aniListPacer) forget(id uint64, at time.Time) {
	p.mu.Lock()
	defer p.mu.Unlock()
	for i, r := range p.pending {
		if r.id == id {
			p.pending = append(p.pending[:i], p.pending[i+1:]...)
			return
		}
	}
	// The entry already expired, so there is nothing left to drop
	if p.now().Sub(at) > aniListPendingTTL {
		return
	}
	// A response for another request already took this entry, so drop the oldest instead
	p.dropExpiredPending(p.now())
	if len(p.pending) > 0 {
		p.pending = p.pending[1:]
	}
}

// slotUsed marks a waiting request as sent.
func (p *aniListPacer) slotUsed(id uint64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if end, ok := p.removeWaiting(id); ok && end.After(p.sentUntil) {
		p.sentUntil = end
	}
}

// cancelSlot gives back the slot of a request that stopped waiting before it was sent.
func (p *aniListPacer) cancelSlot(id uint64) {
	p.mu.Lock()
	defer p.mu.Unlock()
	if _, ok := p.removeWaiting(id); !ok {
		return
	}
	// The queue only needs to reach past requests that were sent or are still waiting
	next := p.sentUntil
	for _, w := range p.waiting {
		if w.end.After(next) {
			next = w.end
		}
	}
	if next.Before(p.next) {
		p.next = next
	}
}

func (p *aniListPacer) removeWaiting(id uint64) (time.Time, bool) {
	for i, w := range p.waiting {
		if w.id == id {
			p.waiting = append(p.waiting[:i], p.waiting[i+1:]...)
			return w.end, true
		}
	}
	return time.Time{}, false
}

// Observe records the budget AniList reported in a response.
func (p *aniListPacer) Observe(headers http.Header) {
	p.mu.Lock()
	defer p.mu.Unlock()
	// This response accounts for the oldest request still on its way, even if it carries no budget
	if len(p.pending) > 0 {
		p.pending = p.pending[1:]
	}

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

	p.limit = limit
	p.remaining = remaining
	p.updatedAt = p.now()

	// The window reset: drop the queue built up while the budget was low.
	// Requests already sent count, so the first response of a burst doesn't release the rest,
	// but ones still waiting for their slot haven't used any budget yet
	inFlight := len(p.pending) - len(p.waiting)
	if inFlight < 0 {
		inFlight = 0
	}
	if remaining-inFlight > limit/aniListPaceBelowFraction && !p.next.IsZero() {
		p.next = time.Time{}
		p.waiting = nil
		p.sentUntil = time.Time{}
		close(p.recovered)
		p.recovered = make(chan struct{})
	}
}

func (p *aniListPacer) dropExpiredPending(now time.Time) {
	i := 0
	for i < len(p.pending) && now.Sub(p.pending[i].at) > aniListPendingTTL {
		i++
	}
	p.pending = p.pending[i:]
}

// WaitForAniListSlot lets AniList requests made outside this package (plugin fetches)
// respect the same rate-limit block and pacing as the server's own requests.
// When it returns nil, call release if the request fails without a response.
func WaitForAniListSlot(ctx context.Context) (release func(), err error) {
	if err := sharedAniListRateBlocker.Wait(ctx, sleepWithContext); err != nil {
		return nil, err
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
