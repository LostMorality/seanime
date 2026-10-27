import { AL_BaseAnime } from "@/api/generated/types"
import { useElectronYoutubeEmbed } from "@/app/(main)/_electron/electron-embed"
import { cn } from "@/components/ui/core/styling"
import { __isElectronDesktop__ } from "@/types/constants"
import { useAtomValue } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import React from "react"
import { FaPlay } from "react-icons/fa"

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

/**
 * Plays the trailer in the anime page banner, the way store pages show a video before the images.
 * It starts muted, has sound while the mouse is over the header, and fades back to the banner image when it ends.
 */
export function EntryBannerTrailer({ media }: { media: AL_BaseAnime | undefined }) {
    const mode = useAtomValue(__entry_trailerModeAtom)
    const { electronEmbedAddress } = useElectronYoutubeEmbed()
    const rootRef = React.useRef<HTMLDivElement>(null)
    const playerRef = React.useRef<any>(null)
    const [size, setSize] = React.useState({ width: 0, height: 0 })
    const [loaded, setLoaded] = React.useState(false)
    const [ended, setEnded] = React.useState(false)
    const hoveredRef = React.useRef(false)

    const trailerId = media?.trailer?.site === "youtube" ? media?.trailer?.id : undefined
    const enabled = mode === "banner" && !!trailerId && (!__isElectronDesktop__ || !!electronEmbedAddress)

    React.useEffect(() => {
        setLoaded(false)
        setEnded(false)
    }, [trailerId])

    const command = React.useCallback((func: string) => {
        const player = playerRef.current
        if (!player) return
        if (__isElectronDesktop__) {
            player.executeJavaScript?.(`window.__yt && window.__yt(${JSON.stringify(func)})`).catch(() => {})
        } else {
            player.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args: [] }), "*")
        }
    }, [])

    // Cover the banner the way object-fit: cover would
    React.useEffect(() => {
        const el = rootRef.current
        if (!el) return
        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setSize(width / height > 16 / 9 ? { width, height: width * 9 / 16 } : { width: height * 16 / 9, height })
        })
        observer.observe(el)
        return () => observer.disconnect()
    }, [enabled])

    // Sound while the mouse is over the header. The player itself doesn't pass mouse events to the page,
    // but the header's text and gradients sit on top of it.
    React.useEffect(() => {
        const header = rootRef.current?.closest("[data-media-page-header]")
        if (!header || !enabled) return
        const onEnter = () => {
            hoveredRef.current = true
            command("unMute")
        }
        const onLeave = () => {
            hoveredRef.current = false
            command("mute")
        }
        header.addEventListener("mouseenter", onEnter)
        header.addEventListener("mouseleave", onLeave)
        return () => {
            header.removeEventListener("mouseenter", onEnter)
            header.removeEventListener("mouseleave", onLeave)
        }
    }, [enabled, command])

    // Electron: watch for the load and for the end of the video (state 0)
    React.useEffect(() => {
        const player = playerRef.current
        if (!enabled || !player || !__isElectronDesktop__) return
        const onLoad = () => {
            window.setTimeout(() => {
                setLoaded(true)
                if (hoveredRef.current) command("unMute")
            }, 1200)
        }
        player.addEventListener("did-finish-load", onLoad)
        const interval = window.setInterval(() => {
            player.executeJavaScript?.("window.__ytState")
                .then((state: number) => {
                    if (state === 0) setEnded(true)
                })
                .catch(() => {})
        }, 1000)
        return () => {
            player.removeEventListener("did-finish-load", onLoad)
            window.clearInterval(interval)
        }
        // The player is only rendered once the banner size is known
    }, [enabled, command, trailerId, size.width > 0])

    if (!enabled || ended) return null

    const webUrl = `https://www.youtube-nocookie.com/embed/${trailerId}?autoplay=1&controls=0&mute=1&disablekb=1&iv_load_policy=3&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`

    return (
        <div
            ref={rootRef}
            data-entry-banner-trailer
            className={cn(
                "absolute inset-0 z-[1] overflow-hidden pointer-events-none transition-opacity duration-1000",
                loaded ? "opacity-100" : "opacity-0",
            )}
        >
            {size.width > 0 && <div
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
                        onLoad={() => window.setTimeout(() => setLoaded(true), 1200)}
                    />}
            </div>}
        </div>
    )
}
