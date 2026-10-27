import { AL_BaseAnime } from "@/api/generated/types"
import { useElectronYoutubeEmbed } from "@/app/(main)/_electron/electron-embed"
import { Button } from "@/components/ui/button"
import { cn } from "@/components/ui/core/styling"
import { Modal } from "@/components/ui/modal"
import { Tooltip } from "@/components/ui/tooltip"
import { __isElectronDesktop__ } from "@/types/constants"
import { useQuery } from "@tanstack/react-query"
import { useAtomValue } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import React from "react"
import { createPortal } from "react-dom"
import { FaPlay } from "react-icons/fa"
import { LuChevronLeft, LuChevronRight, LuMaximize, LuMaximize2, LuRotateCcw, LuVolume2, LuVolumeX } from "react-icons/lu"

export type EntryTrailerMode = "banner" | "banner-one" | "muted" | "click" | "off"

export const __entry_trailerModeAtom = atomWithStorage<EntryTrailerMode>("sea-ui-entry-trailer-mode", "banner", undefined, { getOnInit: true })

export const ENTRY_TRAILER_MODE_OPTIONS: { value: EntryTrailerMode, label: string }[] = [
    { value: "banner", label: "In the banner: every trailer and PV, then artwork (muted, sound while hovering)" },
    { value: "banner-one", label: "In the banner: main trailer only" },
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

    if (mode === "off" || mode === "banner" || mode === "banner-one" || !trailerId) return null
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

type GalleryVideo = { id: string, title: string }
type GalleryItem = { kind: "video", id: string, title: string } | { kind: "image", url: string }

type GalleryPhase = "loading" | "playing" | "fading" | "ended"

// How the banner's sound behaves: follow the mouse, or forced on/off with the speaker button
type BannerSound = "hover" | "on" | "off"

const BANNER_FADE_MS = 1200
const SKIP_FADE_MS = 450
const IMAGE_MS = 6500
// A video that hasn't started playing by then (removed, blocked from embedding) is skipped
const VIDEO_START_TIMEOUT_MS = 10000
// A short beat after playback starts so the first frame is a real one, not a loading frame
const REVEAL_DELAY_MS = 400

// Jikan-compatible MyAnimeList API (the public Jikan API shut down on Oct 1, 2026)
const MAL_API = "https://api.tenrai.org/v1"

/**
 * Every trailer/PV and the artwork MyAnimeList has for an anime.
 * The AniList trailer always comes first, so the gallery still works if the request fails.
 */
function useAnimeGallery(media: AL_BaseAnime | undefined, enabled: boolean) {
    const idMal = media?.idMal
    const { data, isFetched } = useQuery({
        queryKey: ["entry-gallery", idMal],
        queryFn: async () => {
            const get = async (path: string) => {
                const res = await fetch(`${MAL_API}/anime/${idMal}/${path}`, { signal: AbortSignal.timeout(8000) })
                if (!res.ok) throw new Error(`${res.status}`)
                return ((await res.json()) as { data: any }).data
            }
            const [videos, pictures] = await Promise.allSettled([get("videos"), get("pictures")])
            return {
                videos: (videos.status === "fulfilled" ? (videos.value?.promo ?? []) : [])
                    .map((p: any) => ({ id: p?.trailer?.youtube_id as string, title: (p?.title as string) || "PV" }))
                    .filter((v: GalleryVideo) => !!v.id),
                images: (pictures.status === "fulfilled" ? (pictures.value ?? []) : [])
                    .map((p: any) => (p?.webp?.large_image_url || p?.jpg?.large_image_url) as string)
                    .filter(Boolean),
            } as { videos: GalleryVideo[], images: string[] }
        },
        enabled: enabled && !!idMal,
        staleTime: 1000 * 60 * 60 * 6,
        gcTime: 1000 * 60 * 60 * 6,
        retry: false,
        refetchOnWindowFocus: false,
    })

    return React.useMemo(() => {
        const videos: GalleryVideo[] = []
        const anilistId = media?.trailer?.site === "youtube" ? media?.trailer?.id : undefined
        if (anilistId) videos.push({ id: anilistId, title: data?.videos.find(v => v.id === anilistId)?.title ?? "Trailer" })
        for (const v of data?.videos ?? []) {
            if (!videos.some(x => x.id === v.id)) videos.push(v)
        }
        const images = [...(media?.bannerImage ? [media.bannerImage] : []), ...(data?.images ?? [])]
        return { videos, images, ready: !enabled || !idMal || isFetched }
    }, [data, enabled, idMal, isFetched, media?.trailer?.id, media?.trailer?.site, media?.bannerImage])
}

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
 * Plays a gallery in the anime page banner, the way store pages show videos before the images:
 * every trailer and PV, then the artwork, then it settles back on the banner image.
 * Videos are muted with sound while the mouse is over the header. Everything cross-fades through the banner.
 * The control bar can skip, turn the sound on or off, replay, or open the trailers in a window with fullscreen.
 */
export function EntryBannerTrailer({ media }: { media: AL_BaseAnime | undefined }) {
    const mode = useAtomValue(__entry_trailerModeAtom)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()
    const rootRef = React.useRef<HTMLDivElement>(null)
    const playerRef = React.useRef<any>(null)
    const [headerEl, setHeaderEl] = React.useState<Element | null>(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })
    const [phase, setPhase] = React.useState<GalleryPhase>("loading")
    const [index, setIndex] = React.useState(0)
    const [playKey, setPlayKey] = React.useState(0)
    const [fadeMs, setFadeMs] = React.useState(BANNER_FADE_MS)
    const [progress, setProgress] = React.useState({ time: 0, duration: 0 })
    const [sound, setSound] = React.useState<BannerSound>("hover")
    const [hovered, setHovered] = React.useState(false)
    const [scrolledAway, setScrolledAway] = React.useState(false)
    const [pageHidden, setPageHidden] = React.useState(false)
    const [windowOpen, setWindowOpen] = React.useState(false)
    const [windowVideo, setWindowVideo] = React.useState({ index: 0, start: 0 })
    const volumeTimerRef = React.useRef<number | undefined>(undefined)
    // Where to go once the current fade-out finishes (null = stop on the banner)
    const afterFadeRef = React.useRef<number | null>(null)
    const lastStateRef = React.useRef<number | null>(null)
    const revealTimerRef = React.useRef<number | undefined>(undefined)
    const phaseRef = React.useRef(phase)
    phaseRef.current = phase

    const isBannerMode = mode === "banner" || mode === "banner-one"
    const gallery = useAnimeGallery(media, mode === "banner")

    const items = React.useMemo<GalleryItem[]>(() => {
        if (mode === "banner-one") return gallery.videos.slice(0, 1).map(v => ({ kind: "video", ...v }))
        return [
            ...gallery.videos.map(v => ({ kind: "video" as const, ...v })),
            ...gallery.images.map(url => ({ kind: "image" as const, url })),
        ]
    }, [gallery, mode])

    const item = items[index] as GalleryItem | undefined
    const videoId = item?.kind === "video" ? item.id : undefined
    const enabled = isBannerMode && gallery.ready && items.length > 0 && (!__isElectronDesktop__ || !!electronEmbedAddress)
    const audible = phase === "playing" && !!videoId && (sound === "on" || (sound === "hover" && hovered))

    React.useEffect(() => {
        window.clearTimeout(revealTimerRef.current)
        revealTimerRef.current = undefined
        lastStateRef.current = null
        setPhase("loading")
        setIndex(0)
        setProgress({ time: 0, duration: 0 })
        setSound("hover")
    }, [media?.id])

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

    React.useEffect(() => () => {
        window.clearInterval(volumeTimerRef.current)
        window.clearTimeout(revealTimerRef.current)
    }, [])

    React.useEffect(() => {
        if (phase === "loading" || !videoId) return
        if (audible) {
            command("setVolume", [0])
            command("unMute")
            rampVolume(0, 100, 600)
        } else {
            rampVolume(100, 0, 400, () => command("mute"))
        }
    }, [audible])

    // Pause while the banner is scrolled away, the app is hidden, or the trailer window is open
    const paused = scrolledAway || pageHidden || windowOpen
    const shouldPlay = phase === "playing" && !paused
    // Only resume what was paused here: telling a playing video to play makes YouTube flash its pause icon
    const pausedRef = React.useRef(false)
    React.useEffect(() => {
        if (phase === "loading" || phase === "ended" || !videoId) return
        if (!shouldPlay) {
            command("pauseVideo")
            pausedRef.current = true
        } else if (pausedRef.current) {
            command("playVideo")
            pausedRef.current = false
        }
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

    /** Fades the current item out, then moves to `next` (or stops on the banner image when null). */
    const fadeTo = React.useCallback((next: number | null, ms = BANNER_FADE_MS) => {
        if (phaseRef.current !== "playing" && phaseRef.current !== "loading") return
        afterFadeRef.current = next
        phaseRef.current = "fading"
        setFadeMs(ms)
        setPhase("fading")
    }, [])

    const show = React.useCallback((i: number) => {
        lastStateRef.current = null
        pausedRef.current = false
        window.clearTimeout(revealTimerRef.current)
        revealTimerRef.current = undefined
        setProgress({ time: 0, duration: 0 })
        setFadeMs(BANNER_FADE_MS)
        setIndex(i)
        setPlayKey(k => k + 1)
        setPhase("loading")
    }, [])

    React.useEffect(() => {
        if (phase !== "fading") return
        const timer = window.setTimeout(() => {
            const next = afterFadeRef.current
            if (next !== null && next >= 0 && next < items.length) show(next)
            else setPhase("ended")
        }, fadeMs)
        return () => window.clearTimeout(timer)
    }, [phase, fadeMs, items.length, show])

    const skip = (to: number) => {
        if (to < 0 || to >= items.length) return
        if (phase === "ended") show(to)
        else fadeTo(to, SKIP_FADE_MS)
    }

    // Applies a [state, time, duration] report from the player
    const onPlayerReport = React.useCallback((state: number | null, time: number, duration: number) => {
        if (typeof state === "number") lastStateRef.current = state
        if (duration > 0) setProgress({ time, duration })
        // Only fade in once it's actually playing, so a slow or broken video never shows a black frame,
        // and only after a short beat so the first frame shown is a real one
        if (state === 1 && phaseRef.current === "loading" && revealTimerRef.current === undefined) {
            revealTimerRef.current = window.setTimeout(() => setPhase(p => p === "loading" ? "playing" : p), REVEAL_DELAY_MS)
        }
        // Fade out a little before the end so it never sits on YouTube's end screen
        if (state === 0 || (duration > 0 && time >= duration - 1.6)) fadeTo(index + 1)
    }, [fadeTo, index])

    // Skip videos that never start; if the player can't report anything at all, just show it
    React.useEffect(() => {
        if (!enabled || !videoId || phase !== "loading") return
        const timer = window.setTimeout(() => {
            if (lastStateRef.current === null) setPhase(p => p === "loading" ? "playing" : p)
            else fadeTo(index + 1, SKIP_FADE_MS)
        }, VIDEO_START_TIMEOUT_MS)
        return () => window.clearTimeout(timer)
    }, [enabled, videoId, phase, playKey])

    // Electron: the local player page keeps the YouTube state in window variables
    React.useEffect(() => {
        const player = playerRef.current
        if (!enabled || !player || !videoId || !__isElectronDesktop__) return
        const interval = window.setInterval(() => {
            player.executeJavaScript?.("JSON.stringify([window.__ytState ?? null, window.__ytTime, window.__ytDur])")
                .then((json: string) => {
                    const [state, time, duration] = JSON.parse(json) as [number | null, number, number]
                    onPlayerReport(state, time, duration)
                })
                .catch(() => {})
        }, 500)
        return () => window.clearInterval(interval)
        // The player is only rendered once the banner size is known
    }, [enabled, videoId, playKey, size.width > 0, onPlayerReport])

    // Browser: listen to the iframe's own messages
    React.useEffect(() => {
        if (!enabled || !videoId || __isElectronDesktop__) return
        const onMessage = (e: MessageEvent) => {
            if (e.source !== playerRef.current?.contentWindow) return
            try {
                const d = JSON.parse(e.data) as { event?: string, info?: any }
                if (d.event === "onStateChange") onPlayerReport(d.info, progress.time, progress.duration)
                else if (d.info) onPlayerReport(d.info.playerState ?? null, d.info.currentTime ?? 0, d.info.duration ?? 0)
            }
            catch {
            }
        }
        window.addEventListener("message", onMessage)
        return () => window.removeEventListener("message", onMessage)
    }, [enabled, videoId, onPlayerReport, progress.time, progress.duration])

    const onIframeLoad = () => {
        playerRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*")
    }

    // Artwork stays up for a few seconds, then moves on (the timer restarts after a pause)
    React.useEffect(() => {
        if (item?.kind !== "image" || !shouldPlay) return
        const timer = window.setTimeout(() => fadeTo(index + 1), IMAGE_MS)
        return () => window.clearTimeout(timer)
    }, [item?.kind, shouldPlay, index, playKey, fadeTo])

    const replay = () => show(0)

    const videoIndexes = items.flatMap((it, i) => it.kind === "video" ? [i] : [])
    const videos = gallery.videos.slice(0, videoIndexes.length)

    const openWindow = () => {
        const current = videoIndexes.indexOf(index)
        setWindowVideo(current >= 0 && phase !== "ended"
            ? { index: current, start: Math.floor(progress.time) }
            : { index: 0, start: 0 })
        setWindowOpen(true)
        // The banner goes back to its image while the trailer window is open
        fadeTo(null)
    }

    if (!enabled || !item) return null

    const showItem = phase !== "ended"
    const webUrl = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&controls=0&mute=1&disablekb=1&iv_load_policy=3&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
    const label = item.kind === "video" ? item.title : "Artwork"

    const controls = (
        <div
            data-entry-banner-trailer-controls
            className={cn(
                "absolute right-6 top-14 z-[6] hidden lg:flex items-center gap-0.5 rounded-full",
                "bg-black/45 backdrop-blur-md border border-white/10 shadow-lg px-1 py-1 overflow-hidden",
                "transition-opacity duration-500",
                (phase === "loading" && index === 0 && playKey === 0) ? "opacity-0 pointer-events-none" : "opacity-100",
            )}
        >
            {items.length > 1 && phase !== "ended" && <BannerTrailerButton label="Previous" onClick={() => skip(index - 1)} disabled={index === 0}>
                <LuChevronLeft />
            </BannerTrailerButton>}
            {phase !== "ended" && !!videoId && <BannerTrailerButton
                label={sound === "on" ? "Mute" : "Sound on"}
                onClick={() => setSound(s => s === "on" ? "off" : "on")}
            >
                {audible ? <LuVolume2 /> : <LuVolumeX />}
            </BannerTrailerButton>}
            {phase === "ended" && <BannerTrailerButton label={items.length > 1 ? "Play again" : "Replay trailer"} onClick={replay}>
                <LuRotateCcw />
            </BannerTrailerButton>}
            {items.length > 1 && phase !== "ended" && <span
                data-entry-banner-trailer-label
                className="px-1.5 max-w-[11rem] truncate text-[0.7rem] font-medium text-white/75 tabular-nums"
            >
                {label} <span className="text-white/45">{index + 1}/{items.length}</span>
            </span>}
            {items.length > 1 && phase !== "ended" && <BannerTrailerButton
                label="Next"
                onClick={() => skip(index + 1)}
                disabled={index === items.length - 1}
            >
                <LuChevronRight />
            </BannerTrailerButton>}
            {videos.length > 0 && <BannerTrailerButton label={videos.length > 1 ? "Watch trailers" : "Watch trailer"} onClick={openWindow} wide>
                <LuMaximize2 /><span className="text-xs font-semibold tracking-wide">{videos.length > 1 ? "Trailers" : "Trailer"}</span>
            </BannerTrailerButton>}
            {phase !== "ended" && <div className="absolute left-3 right-3 bottom-0 h-[2px] rounded-full bg-white/15 overflow-hidden">
                {item.kind === "video"
                    ? <div
                        className="h-full bg-white/80 transition-[width] duration-500 ease-linear"
                        style={{ width: `${progress.duration > 0 ? Math.min(100, (progress.time / progress.duration) * 100) : 0}%` }}
                    />
                    : <TimedBar key={`${playKey}-${shouldPlay}`} ms={shouldPlay ? IMAGE_MS : 0} />}
            </div>}
        </div>
    )

    return (
        <>
            <div
                ref={rootRef}
                data-entry-banner-trailer={phase}
                data-entry-banner-trailer-index={index}
                className={cn(
                    "absolute inset-0 z-[1] overflow-hidden pointer-events-none transition-opacity ease-in-out",
                    phase === "playing" ? "opacity-100" : "opacity-0",
                )}
                style={{ transitionDuration: `${fadeMs}ms` }}
            >
                {(showItem && size.width > 0 && item.kind === "video") && <div
                    key={playKey}
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{ width: size.width, height: size.height }}
                >
                    {__isElectronDesktop__
                        ? <webview
                            ref={playerRef}
                            src={`${electronEmbedAddress}hero_${videoId}`}
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
                {(showItem && item.kind === "image") && <GalleryImage
                    key={playKey}
                    url={item.url}
                    ms={IMAGE_MS + BANNER_FADE_MS}
                    onReady={() => setPhase(p => p === "loading" ? "playing" : p)}
                    onError={() => fadeTo(index + 1, 0)}
                />}
            </div>

            {headerEl && createPortal(controls, headerEl)}

            <TrailerWindow
                open={windowOpen}
                onOpenChange={setWindowOpen}
                videos={videos}
                initialIndex={windowVideo.index}
                start={windowVideo.start}
                title={media?.title?.userPreferred}
                electronEmbedAddress={electronEmbedAddress}
            />
        </>
    )
}

/**
 * One piece of artwork, slowly zooming. Wide images fill the banner;
 * posters sit on the right, clear of the title and description, over a blurred copy of themselves so they aren't cropped.
 */
function GalleryImage({ url, ms, onReady, onError }: { url: string, ms: number, onReady: () => void, onError: () => void }) {
    const [wide, setWide] = React.useState<boolean | null>(null)
    const [zoom, setZoom] = React.useState(false)

    React.useEffect(() => {
        if (wide === null) return
        const frame = window.requestAnimationFrame(() => setZoom(true))
        return () => window.cancelAnimationFrame(frame)
    }, [wide])

    const zoomStyle: React.CSSProperties = {
        transform: zoom ? "scale(1.07)" : "scale(1)",
        transformOrigin: "75% 50%",
        transition: `transform ${ms}ms linear`,
    }

    return (
        <div className="absolute inset-0 bg-black" data-entry-banner-gallery-image>
            {wide === false && <img
                src={url}
                alt=""
                className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-60 scale-110"
            />}
            <img
                src={url}
                alt=""
                className={cn("absolute inset-0 w-full h-full", wide === false ? "object-contain object-right py-6 pr-[6%]" : "object-cover")}
                style={zoomStyle}
                onLoad={e => {
                    const img = e.currentTarget
                    setWide(img.naturalWidth / img.naturalHeight > 1.4)
                    onReady()
                }}
                onError={onError}
            />
        </div>
    )
}

/** A progress bar that fills over `ms` (0 = empty and still). */
function TimedBar({ ms }: { ms: number }) {
    const [full, setFull] = React.useState(false)
    React.useEffect(() => {
        if (!ms) return
        const frame = window.requestAnimationFrame(() => setFull(true))
        return () => window.cancelAnimationFrame(frame)
    }, [ms])
    return <div
        className="h-full bg-white/80"
        style={{ width: full ? "100%" : "0%", transition: ms ? `width ${ms}ms linear` : undefined }}
    />
}

function BannerTrailerButton({ label, onClick, wide, disabled, children }: {
    label: string
    onClick: () => void
    wide?: boolean
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <Tooltip
            trigger={<button
                type="button"
                aria-label={label}
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    "h-8 flex items-center justify-center gap-1.5 rounded-full text-white/85 text-base",
                    "hover:bg-white/15 hover:text-white transition-colors disabled:opacity-35 disabled:pointer-events-none",
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
 * The trailers in a window, with sound, YouTube's controls and a fullscreen button.
 * When there's more than one, a row of buttons switches between them.
 * When opened from the banner it continues from where the banner was.
 */
export function TrailerWindow({ open, onOpenChange, videos, initialIndex = 0, start, title, electronEmbedAddress }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    videos: GalleryVideo[]
    initialIndex?: number
    start: number
    title?: string | null
    electronEmbedAddress: string | null
}) {
    const playerRef = React.useRef<any>(null)
    const [current, setCurrent] = React.useState({ index: initialIndex, start })

    React.useEffect(() => {
        if (open) setCurrent({ index: initialIndex, start })
    }, [open])

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

    const video = videos[current.index] ?? videos[0]
    if (!video) return null

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
                            key={`${video.id}-${current.start}`}
                            ref={playerRef}
                            src={`${electronEmbedAddress}watch_${current.start}_${video.id}`}
                            style={{ width: "100%", height: "100%" }}
                            allowFullScreen
                        />)
                        : <iframe
                            key={`${video.id}-${current.start}`}
                            ref={playerRef}
                            {...({ credentialless: "true" } as any)}
                            src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&start=${current.start}&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1`}
                            title="Trailer"
                            className="w-full h-full"
                            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                        />)}
                </div>
                <div className="flex items-start gap-3">
                    {videos.length > 1 && <div className="flex flex-wrap gap-1.5 flex-1" data-entry-trailer-window-list>
                        {videos.map((v, i) => (
                            <Button
                                key={v.id}
                                size="sm"
                                intent={i === current.index ? "white" : "gray-subtle"}
                                onClick={() => setCurrent({ index: i, start: 0 })}
                            >
                                {v.title}
                            </Button>
                        ))}
                    </div>}
                    <Button intent="gray-subtle" size="sm" leftIcon={<LuMaximize />} onClick={goFullscreen} className="ml-auto">
                        Fullscreen
                    </Button>
                </div>
            </div>
        </Modal>
    )
}

/**
 * The "Trailer" link on anime pages, opening the same window as the banner (every trailer/PV, captions, fullscreen).
 */
export function TrailerWindowButton({ media, trigger }: { media: AL_BaseAnime | undefined, trigger: React.ReactElement }) {
    const [open, setOpen] = React.useState(false)
    const mode = useAtomValue(__entry_trailerModeAtom)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()
    const { videos } = useAnimeGallery(media, open || mode === "banner")
    if (!videos.length) return null
    // The banner's own Trailers button replaces this link on screens wide enough to show it
    const inBanner = mode === "banner" || mode === "banner-one"
    const triggerEl = trigger as React.ReactElement<any>
    return <>
        {React.cloneElement(triggerEl, {
            onClick: () => setOpen(true),
            className: cn(triggerEl.props.className, inBanner && "lg:hidden"),
        })}
        <TrailerWindow
            open={open}
            onOpenChange={setOpen}
            videos={videos}
            start={0}
            title={media?.title?.userPreferred}
            electronEmbedAddress={electronEmbedAddress}
        />
    </>
}
