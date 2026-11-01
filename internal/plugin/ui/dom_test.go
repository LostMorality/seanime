package plugin_ui

import (
	"seanime/internal/events"
	"seanime/internal/extension"
	gojautil "seanime/internal/util/goja"
	"testing"
	"time"

	"github.com/dop251/goja"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/require"
)

func TestDOMQueryGivesUpWithoutClient(t *testing.T) {
	prev := clientRequestTimeout
	clientRequestTimeout = 100 * time.Millisecond
	t.Cleanup(func() { clientRequestTimeout = prev })

	// A silent logger, since util.NewLogger writes to a shared buffer that leftover timers would race on
	nop := zerolog.Nop()
	logger := &nop
	scheduler := gojautil.NewScheduler()
	ws := events.NewMockWSEventManager(logger)
	vm := goja.New()
	vm.SetFieldNameMapper(goja.TagFieldNameMapper("json", true))
	ui := NewUI(NewUIOptions{
		Logger:    logger,
		VM:        vm,
		WSManager: ws,
		Scheduler: scheduler,
		Extension: &extension.Extension{ID: "dom-test", Plugin: &extension.PluginManifest{}},
	})
	t.Cleanup(func() {
		ui.context.Stop()
		// Stop queues one more event batch, flushing it also stops its timer
		ui.context.flushEventBatch()
	})
	ctx := ui.context
	run := func(script string) goja.Value {
		t.Helper()
		var ret goja.Value
		require.NoError(t, scheduler.Schedule(func() error {
			v, err := ui.vm.RunString(script)
			ret = v
			return err
		}))
		ctx.flushEventBatch()
		return ret
	}
	require.NoError(t, scheduler.Schedule(func() error {
		return ui.vm.Set("query", ctx.domManager.jsQuery)
	}))
	listenerCount := func() int {
		listeners, ok := ctx.eventBus.Get(ClientDOMQueryResultEvent)
		if !ok {
			return 0
		}
		n := 0
		listeners.Range(func(string, *EventListener) bool { n++; return true })
		return n
	}

	// Nobody answers, so the query settles empty once the timeout passes
	run(`globalThis.first = null; query("div").then(v => { first = v })`)
	require.Equal(t, 1, listenerCount())
	require.Eventually(t, func() bool {
		return run(`first !== null && first.length === 0`).ToBoolean()
	}, 2*time.Second, 20*time.Millisecond)
	require.Equal(t, 0, listenerCount())

	// An answer in time wins and the timeout doesn't replace it later
	run(`globalThis.second = null; query("span").then(v => { second = v })`)
	sent := ws.Events()[len(ws.Events())-1].Payload.(*ServerPluginEvent).Payload.(*ServerDOMQueryEventPayload)
	listeners, ok := ctx.eventBus.Get(ClientDOMQueryResultEvent)
	require.True(t, ok)
	listeners.Range(func(_ string, listener *EventListener) bool {
		listener.Send(&ClientPluginEvent{
			Type: ClientDOMQueryResultEvent,
			Payload: ClientDOMQueryResultEventPayload{
				RequestID: sent.RequestID,
				Elements:  []interface{}{map[string]interface{}{"id": "a", "tagName": "SPAN"}},
			},
		})
		return true
	})
	require.Eventually(t, func() bool {
		return run(`second !== null && second.length === 1`).ToBoolean()
	}, time.Second, 10*time.Millisecond)
	time.Sleep(3 * clientRequestTimeout)
	require.True(t, run(`second.length === 1 && second[0].id === "a"`).ToBoolean())
	require.Equal(t, 0, listenerCount())

	// Querying inside an element that's gone settles as soon as the client says so, not after the timeout
	clientRequestTimeout = time.Hour
	require.NoError(t, scheduler.Schedule(func() error {
		return ui.vm.Set("queryIn", func(id, selector string) goja.Value {
			return ctx.domManager.elementQuery(id, selector, QueryElementOptions{})
		})
	}))
	run(`globalThis.third = null; queryIn("gone", "a").then(v => { third = v })`)
	manipulate := ws.Events()[len(ws.Events())-1].Payload.(*ServerPluginEvent).Payload.(*ServerDOMManipulateEventPayload)
	require.Equal(t, "query", manipulate.Action)
	updated, ok := ctx.eventBus.Get(ClientDOMElementUpdatedEvent)
	require.True(t, ok)
	updated.Range(func(_ string, listener *EventListener) bool {
		listener.Send(&ClientPluginEvent{
			Type:    ClientDOMElementUpdatedEvent,
			Payload: ClientDOMElementUpdatedEventPayload{ElementId: "gone", Action: "query", RequestID: manipulate.RequestID},
		})
		return true
	})
	require.Eventually(t, func() bool {
		return run(`third !== null && third.length === 0`).ToBoolean()
	}, time.Second, 10*time.Millisecond)
}
