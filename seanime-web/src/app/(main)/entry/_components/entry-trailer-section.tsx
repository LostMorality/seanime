import { AL_BaseAnime } from "@/api/generated/types"
import { useElectronYoutubeEmbed } from "@/app/(main)/_electron/electron-embed"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Modal } from "@/components/ui/modal"
import { Tooltip } from "@/components/ui/tooltip"
import { __isElectronDesktop__ } from "@/types/constants"
import { useAtomValue } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import React from "react"
import { createPortal } from "react-dom"
import { FaPlay } from "react-icons/fa"
import { LuMaximize, LuMaximize2, LuRotateCcw, LuVolume2, LuVolumeX } from "react-icons/lu"

export type EntryTrailerMode = "banner" | "muted" | "click" | "off"

export const __entry_trailerModeAtom = atomWithStorage<EntryTrailerMode>("sea-ui-entry-trailer-mode", "banner", undefined, { getOnInit: true })

export const ENTRY_TRAILER_MODE_OPTIONS: { value: EntryTrailerMode, label: string }[] = [
    { value: "banner", label: "In the banner: plays once, muted, sound while hovering" },
    { value: "muted", label: "Below the episodes: muted, sound while hovering" },
    { value: "click", label: "Below the episodes: click to play" },
    { value: "off", label: "Off" },
]

/**
 * YouTube trailer on anime pages. Captions are forced on (English when available).
 * In "muted" mode it plays without sound, unmutes while the mouse is over it, and pauses when scrolled out of view.
 */
export function EntryTrailerSection({ media }: { media: AL_BaseAnime | undefined }) {
    const mode = useAtomValue(__entry_trailerModeAtom)
    const [started, setStarted] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)
    const playerRef = React.useRef<any>(null)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()

    const trailerId = media?.trailer?.site === "youtube" ? media?.trailer?.id : undefined

    React.useEffect(() => {
        setStarted(false)
    }, [trailerId])

    const playing = mode === "muted" || started

    // Sends a YouTube player command (mute, unMute, playVideo, pauseVideo)
    const command = React.useCallback((func: string) => {
        const player = playerRef.current
        if (!player) return
        if (__isElectronDesktop__) {
            player.executeJavaScript?.(`window.__yt && window.__yt(${JSON.stringify(func)})`).catch(() => {})
        } else {
            player.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*")
        }
    }, [])

    // The player only loads once the section has been scrolled into view
    const [seen, setSeen] = React.useState(false)
    const visibleRef = React.useRef(false)
    const hoveredRef = React.useRef(false)

    // Commands sent before the YouTube player is ready get dropped, so the current state is re-applied after it loads
    const syncPlayer = React.useCallback(() => {
        command(visibleRef.current ? "playVideo" : "pauseVideo")
        if (mode === "muted") command(hoveredRef.current ? "unMute" : "mute")
    }, [command, mode])

    React.useEffect(() => {
        if (!containerRef.current) return
        const observer = new IntersectionObserver(([entry]) => {
            visibleRef.current = entry.isIntersecting
            if (entry.isIntersecting) setSeen(true)
            command(entry.isIntersecting ? "playVideo" : "pauseVideo")
        }, { threshold: 0.25 })
        observer.observe(containerRef.current)
        return () => observer.disconnect()
    }, [command, trailerId, mode])

    const onPlayerLoad = React.useCallback(() => {
        window.setTimeout(syncPlayer, 1500)
        window.setTimeout(syncPlayer, 4000)
    }, [syncPlayer])

    React.useEffect(() => {
        const player = playerRef.current
        if (!player || !__isElectronDesktop__) return
        player.addEventListener("did-finish-load", onPlayerLoad)
        return () => player.removeEventListener("did-finish-load", onPlayerLoad)
    }, [onPlayerLoad, seen, playing])

    const setHovered = (hovered: boolean) => {
        hoveredRef.current = hovered
        if (mode === "muted") command(hovered ? "unMute" : "mute")
    }

    if (mode === "off" || mode === "banner" || !trailerId) return null
    if (__isElectronDesktop__ && !electronEmbedAddress) return null

    const prefix = mode === "muted" ? "inline_" : "play_"
    const webUrl = mode === "muted"
        ? `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&mute=1&loop=1&playlist=${trailerId}&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
        : `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`

    return (
        <div className="space-y-4" data-entry-trailer-section>
            <h2>Trailer</h2>
            {/* The page doesn't get mouse events over the embedded player, so the padding acts as the hover edge */}
            <div
                ref={containerRef}
                className="w-full max-w-3xl p-2 rounded-2xl border bg-[--paper]"
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            >
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                    {(playing && seen) ? (
                        __isElectronDesktop__
                            ? <webview
                                ref={playerRef}
                                src={`${electronEmbedAddress}${prefix}${trailerId}`}
                                style={{ width: "100%", height: "100%" }}
                                allowFullScreen
                            />
                            : <iframe
                                ref={playerRef}
                                {...({ credentialless: "true" } as any)}
                                src={webUrl}
                                title="Trailer"
                                className="w-full h-full"
                                allow="autoplay; encrypted-media; picture-in-picture"
                                allowFullScreen
                                referrerPolicy="strict-origin-when-cross-origin"
                                onLoad={onPlayerLoad}
                            />
                    ) : playing ? null : (
                        <button
                            className="group absolute inset-0 w-full h-full"
                            onClick={() => setStarted(true)}
                            aria-label="Play trailer"
                        >
                            {!!media?.trailer?.thumbnail && <img
                                src={media.trailer.thumbnail}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                            />}
                            <span
                                className={cn(
                                    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center",
                                    "size-16 rounded-full bg-black/70 text-white text-2xl transition-transform group-hover:scale-110",
                                )}
                            ><FaPlay className="ml-1" /></span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}

type BannerPhase = "loading" | "playing" | "fading" | "ended"

// How the banner trailer's sound behaves: follow the mouse, or forced on/off with the speaker button
type BannerSound = "hover" | "on" | "off"

const BANNER_FADE_MS = 1200

/**
 * Sends a YouTube player command to an Electron webview (through the local player page) or a plain iframe.
 */
function sendPlayerCommand(player: any, func: string, args: unknown[] = []) {
    if (!player) return
    if (__isElectronDesktop__) {
        player.executeJavaScript?.(`window.__yt && window.__yt(${JSON.stringify(func)}, ${JSON.stringify(args)})`).catch(() => {})
    } else {
        player.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*")
    }
}

/**
 * Plays the trailer in the anime page banner, the way store pages show a video before the images.
 * It fades in muted, has sound while the mouse is over the header, and fades back to the banner image near the end.
 * A small control bar lets you turn the sound on or off, replay it, or open it in a window with fullscreen.
 */
export function EntryBannerTrailer({ media }: { media: AL_BaseAnime | undefined }) {
    const mode = useAtomValue(__entry_trailerModeAtom)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()
    const rootRef = React.useRef<HTMLDivElement>(null)
    const playerRef = React.useRef<any>(null)
    const [headerEl, setHeaderEl] = React.useState<Element | null>(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })
    const [phase, setPhase] = React.useState<BannerPhase>("loading")
    const [playKey, setPlayKey] = React.useState(0)
    const [progress, setProgress] = React.useState({ time: 0, duration: 0 })
    const [sound, setSound] = React.useState<BannerSound>("hover")
    const [hovered, setHovered] = React.useState(false)
    const [scrolledAway, setScrolledAway] = React.useState(false)
    const [pageHidden, setPageHidden] = React.useState(false)
    const [windowOpen, setWindowOpen] = React.useState(false)
    const [windowStart, setWindowStart] = React.useState(0)
    const volumeTimerRef = React.useRef<number | undefined>(undefined)

    const trailerId = media?.trailer?.site === "youtube" ? media?.trailer?.id : undefined
    const enabled = mode === "banner" && !!trailerId && (!__isElectronDesktop__ || !!electronEmbedAddress)
    const audible = phase === "playing" && (sound === "on" || (sound === "hover" && hovered))

    React.useEffect(() => {
        setPhase("loading")
        setProgress({ time: 0, duration: 0 })
        setSound("hover")
    }, [trailerId])

    const command = React.useCallback((func: string, args: unknown[] = []) => sendPlayerCommand(playerRef.current, func, args), [])

    // Volume ramps instead of switching sound on and off abruptly
    const rampVolume = React.useCallback((from: number, to: number, ms: number, onDone?: () => void) => {
        window.clearInterval(volumeTimerRef.current)
        const steps = 10
        let step = 0
        volumeTimerRef.current = window.setInterval(() => {
            step++
            command("setVolume", [Math.round(from + (to - from) * (step / steps))])
            if (step >= steps) {
                window.clearInterval(volumeTimerRef.current)
                onDone?.()
            }
        }, ms / steps)
    }, [command])

    React.useEffect(() => () => window.clearInterval(volumeTimerRef.current), [])

    React.useEffect(() => {
        if (phase === "loading") return
        if (audible) {
            command("setVolume", [0])
            command("unMute")
            rampVolume(0, 100, 600)
        } else {
            rampVolume(100, 0, 400, () => command("mute"))
        }
    }, [audible])

    // Pause while the banner is scrolled away, the app is hidden, or the trailer window is open
    const shouldPlay = phase === "playing" && !scrolledAway && !pageHidden && !windowOpen
    React.useEffect(() => {
        if (phase === "loading" || phase === "ended") return
        command(shouldPlay ? "playVideo" : "pauseVideo")
    }, [shouldPlay])

    React.useEffect(() => {
        if (!enabled) return
        const onScroll = () => setScrolledAway(window.scrollY > 300)
        const onVisibility = () => setPageHidden(document.hidden)
        window.addEventListener("scroll", onScroll, { passive: true })
        document.addEventListener("visibilitychange", onVisibility)
        return () => {
            window.removeEventListener("scroll", onScroll)
            document.removeEventListener("visibilitychange", onVisibility)
        }
    }, [enabled])

    // Cover the banner the way object-fit: cover would
    React.useEffect(() => {
        const el = rootRef.current
        if (!el) return
        setHeaderEl(el.closest("[data-media-page-header]"))
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setSize(width / height > 16 / 9 ? { width, height: width * 9 / 16 } : { width: height * 16 / 9, height })
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [enabled])

    // The player itself doesn't pass mouse events to the page, but the header's text and gradients sit on top of it
    React.useEffect(() => {
        if (!headerEl || !enabled) return
        const onEnter = () => setHovered(true)
        const onLeave = () => setHovered(false)
        headerEl.addEventListener("mouseenter", onEnter)
        headerEl.addEventListener("mouseleave", onLeave)
        return () => {
            headerEl.removeEventListener("mouseenter", onEnter)
            headerEl.removeEventListener("mouseleave", onLeave)
        }
    }, [headerEl, enabled])

    const fadeOut = React.useCallback(() => {
        setPhase(p => (p === "playing" || p === "loading") ? "fading" : p)
    }, [])

    React.useEffect(() => {
        if (phase !== "fading") return
        const timer = window.setTimeout(() => setPhase("ended"), BANNER_FADE_MS)
        return () => window.clearTimeout(timer)
    }, [phase])

    // Applies a [state, time, duration] report from the player
    const onPlayerReport = React.useCallback((state: number, time: number, duration: number) => {
        if (duration > 0) setProgress({ time, duration })
        // Fade out a little before the end so it never sits on YouTube's end screen
        if (state === 0 || (duration > 0 && time >= duration - 1.6)) fadeOut()
    }, [fadeOut])

    // Electron: the local player page keeps the YouTube state in window variables
    React.useEffect(() => {
        const player = playerRef.current
        if (!enabled || !player || !__isElectronDesktop__) return
        const onLoad = () => window.setTimeout(() => setPhase(p => p === "loading" ? "playing" : p), 1200)
        player.addEventListener("did-finish-load", onLoad)
        const interval = window.setInterval(() => {
            player.executeJavaScript?.("JSON.stringify([window.__ytState, window.__ytTime, window.__ytDur])")
                .then((json: string) => {
                    const [state, time, duration] = JSON.parse(json) as [number, number, number]
                    onPlayerReport(state, time, duration)
                })
                .catch(() => {})
        }, 500)
        return () => {
            player.removeEventListener("did-finish-load", onLoad)
            window.clearInterval(interval)
        }
        // The player is only rendered once the banner size is known
    }, [enabled, trailerId, playKey, size.width > 0, onPlayerReport])

    // Browser: listen to the iframe's own messages
    React.useEffect(() => {
        if (!enabled || __isElectronDesktop__) return
        const onMessage = (e: MessageEvent) => {
            if (e.source !== playerRef.current?.contentWindow) return
            try {
                const d = JSON.parse(e.data) as { event?: string, info?: any }
                if (d.event === "onStateChange") onPlayerReport(d.info, progress.time, progress.duration)
                else if (d.info) onPlayerReport(d.info.playerState ?? -1, d.info.currentTime ?? 0, d.info.duration ?? 0)
            }
            catch {
            }
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [enabled, onPlayerReport, progress.time, progress.duration])

    const onIframeLoad = () => {
        playerRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")
        window.setTimeout(() => setPhase(p => p === "loading" ? "playing" : p), 1200)
    }

    const replay = () => {
        setProgress({ time: 0, duration: 0 })
        setPhase("loading")
        setPlayKey(k => k + 1)
    }

    const openWindow = () => {
        setWindowStart(phase === "ended" ? 0 : Math.floor(progress.time))
        setWindowOpen(true)
        // The banner goes back to its image while the full trailer plays
        fadeOut()
    }

    if (!enabled) return null

    const showVideo = phase !== "ended"
    const webUrl = `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&controls=0&mute=1&disablekb=1&iv_load_policy=3&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`

    const controls = (
        <div
            data-entry-banner-trailer-controls
            className={cn(
                "absolute right-6 top-14 z-[6] hidden lg:flex items-center gap-0.5 rounded-full",
                "bg-black/45 backdrop-blur-md border border-white/10 shadow-lg px-1 py-1 overflow-hidden",
                "transition-opacity duration-500",
                phase === "loading" ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
        >
            {phase !== "ended" && <BannerTrailerButton
                label={sound === "on" ? "Mute" : "Sound on"}
                onClick={() => setSound(s => s === "on" ? "off" : "on")}
            >
                {audible ? <LuVolume2 /> : <LuVolumeX />}
            </BannerTrailerButton>}
            {phase === "ended" && <BannerTrailerButton label="Replay trailer" onClick={replay}>
                <LuRotateCcw />
            </BannerTrailerButton>}
            <BannerTrailerButton label="Watch trailer" onClick={openWindow} wide>
                <LuMaximize2 /><span className="text-xs font-semibold tracking-wide">Trailer</span>
            </BannerTrailerButton>
            {(phase === "playing" || phase === "fading") && progress.duration > 0 && <div
                className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-white/15 overflow-hidden"
            >
                <div
                    className="h-full bg-white/80 transition-[width] duration-500 ease-linear"
                    style={{ width: `${Math.min(100, (progress.time / progress.duration) * 100)}%` }}
                />
            </div>}
        </div>
    )

    return (
        <>
            <div
                ref={rootRef}
                data-entry-banner-trailer={phase}
                className={cn(
                    "absolute inset-0 z-[1] overflow-hidden pointer-events-none transition-opacity ease-in-out",
                    phase === "playing" ? "opacity-100" : "opacity-0",
                )}
                style={{ transitionDuration: `${BANNER_FADE_MS}ms` }}
            >
                {(showVideo && size.width > 0) && <div
                    key={playKey}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: size.width, height: size.height }}
                >
                    {__isElectronDesktop__
                        ? <webview
                            ref={playerRef}
                            src={`${electronEmbedAddress}hero_${trailerId}`}
                            style={{ width: "100%", height: "100%" }}
                        />
                        : <iframe
                            ref={playerRef}
                            {...({ credentialless: "true" } as any)}
                            src={webUrl}
                            title="Trailer"
                            className="w-full h-full"
                            allow="autoplay; encrypted-media"
                            referrerPolicy="strict-origin-when-cross-origin"
                            onLoad={onIframeLoad}
                        />}
                </div>}
            </div>

            {headerEl && createPortal(controls, headerEl)}

            <TrailerWindow
                open={windowOpen}
                onOpenChange={setWindowOpen}
                trailerId={trailerId}
                start={windowStart}
                title={media?.title?.userPreferred}
                electronEmbedAddress={electronEmbedAddress}
            />
        </>
    )
}

function BannerTrailerButton({ label, onClick, wide, children }: {
    label: string
    onClick: () => void
    wide?: boolean
    children: React.ReactNode
}) {
    return (
        <Tooltip
            trigger={<button
                type="button"
                aria-label={label}
                onClick={onClick}
                className={cn(
                    "h-8 flex items-center justify-center gap-1.5 rounded-full text-white/85 text-base",
                    "hover:bg-white/15 hover:text-white transition-colors",
                    wide ? "px-3" : "w-8",
                )}
            >
                {children}
            </button>}
        >
            {label}
        </Tooltip>
    )
}

/**
 * The trailer in a window, with sound, YouTube's controls and a fullscreen button.
 * When opened from the banner it continues from where the banner was.
 */
export function TrailerWindow({ open, onOpenChange, trailerId, start, title, electronEmbedAddress }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    trailerId: string | undefined
    start: number
    title?: string | null
    electronEmbedAddress: string | null
}) {
    const playerRef = React.useRef<any>(null)

    const goFullscreen = () => {
        const player = playerRef.current
        if (!player) return
        if (__isElectronDesktop__) {
            // Fullscreen needs a user gesture inside the player page
            player.executeJavaScript?.("window.__ytFullscreen && window.__ytFullscreen()", true).catch(() => {})
        } else {
            player.requestFullscreen?.()
        }
    }

    if (!trailerId) return null

    return (
        <Modal
            open={open}
            onOpenChange={onOpenChange}
            title={title ?? "Trailer"}
            contentClass="max-w-6xl"
        >
            <div className="space-y-3" data-entry-trailer-window>
                <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
                    {open && (__isElectronDesktop__
                        ? (electronEmbedAddress && <webview
                            ref={playerRef}
                            src={`${electronEmbedAddress}watch_${start}_${trailerId}`}
                            style={{ width: "100%", height: "100%" }}
                            allowFullScreen
                        />)
                        : <iframe
                            ref={playerRef}
                            {...({ credentialless: "true" } as any)}
                            src={`https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&start=${start}&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1`}
                            title="Trailer"
                            className="w-full h-full"
                            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                        />)}
                </div>
                <div className="flex justify-end">
                    <Button intent="gray-subtle" size="sm" leftIcon={<LuMaximize />} onClick={goFullscreen}>
                        Fullscreen
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

/**
 * The "Trailer" link on anime pages, opening the same window as the banner (captions, fullscreen).
 */
export function TrailerWindowButton({ trailerId, title, trigger }: { trailerId: string, title?: string | null, trigger: React.ReactElement }) {
    const [open, setOpen] = React.useState(false)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()
    return <>
        {React.cloneElement(trigger as React.ReactElement<any>, { onClick: () => setOpen(true) })}
        <TrailerWindow
            open={open}
            onOpenChange={setOpen}
            trailerId={trailerId}
            start={0}
            title={title}
            electronEmbedAddress={electronEmbedAddress}
        />
    </>
}
