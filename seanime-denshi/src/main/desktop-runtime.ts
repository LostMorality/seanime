import { app, net } from "electron"
import http from "node:http"
import type { AddressInfo } from "node:net"
import { log } from "./logging"

const LOCAL_EMBED_HOST = "127.0.0.1"
const DESKTOP_SERVER_HOST = "127.0.0.1"
const DESKTOP_SERVER_DEFAULT_PORT = 43211
const DESKTOP_SERVER_DEV_PORT = 43000

export const allowedWebviewOrigins = new Set<string>()

let localServerPort: number | undefined

export function getLocalServerPort(): number | undefined {
    return localServerPort
}

export function isAllowedLocalEmbedURL(rawURL: string): boolean {
    if (!localServerPort) return false

    try {
        const parsed = new URL(rawURL)
        return parsed.protocol === "http:"
            && parsed.hostname === LOCAL_EMBED_HOST
            && parsed.port === String(localServerPort)
            && parsed.pathname.startsWith("/player/")
    }
    catch {
        return false
    }
}

export function normalizeUpdateFeedURL(candidate: string, fallbackURL: string): string {
    try {
        const parsed = new URL(candidate)
        if (parsed.protocol !== "https:" || !parsed.host) {
            throw new Error("update feeds must use https")
        }
        return parsed.toString()
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        log.warn(`[Denshi] Ignoring update feed URL ${candidate}: ${message}`)
        return fallbackURL
    }
}

export function getDesktopServerPort(): number {
    if (process.env.NODE_ENV === "development") return DESKTOP_SERVER_DEV_PORT

    const envPort = Number.parseInt(process.env.SEANIME_SERVER_PORT || "", 10)
    if (Number.isInteger(envPort) && envPort > 0) return envPort
    return DESKTOP_SERVER_DEFAULT_PORT
}

export function getDesktopServerBaseUrl(): string {
    return `http://${DESKTOP_SERVER_HOST}:${getDesktopServerPort()}`
}

export async function isDesktopServerReachable(): Promise<boolean> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 1000)
    try {
        const response = await net.fetch(`${getDesktopServerBaseUrl()}/api/v1/status`, {
            signal: controller.signal,
        })
        return response.ok
    }
    catch {
        return false
    }
    finally {
        clearTimeout(timeoutId)
    }
}

// Banner (hero_) players run without controls, but YouTube's newer player still shows its play/pause button
// over the video for the first few seconds. Hide YouTube's own controls inside those players only.
const HERO_PLAYER_CSS = ".player-controls-background-container,.ytPlayerControlsContainerHost,.ytp-chrome-top,.ytp-chrome-bottom,.ytp-gradient-top,.ytp-gradient-bottom,.ytp-large-play-button,.ytp-pause-overlay,.ytp-bezel,.ytp-watermark{display:none!important}"
let heroPlayerStyleHooked = false

function hideHeroPlayerControls() {
    if (heroPlayerStyleHooked) return
    heroPlayerStyleHooked = true
    app.on("web-contents-created", (_event, contents) => {
        contents.on("frame-created", (_e, { frame }) => {
            frame?.on("dom-ready", () => {
                if (frame.isDestroyed() || frame === contents.mainFrame) return
                if (!contents.getURL().includes("/player/hero_")) return
                if (!frame.url.startsWith("https://www.youtube-nocookie.com/embed/")) return
                frame.executeJavaScript(`(()=>{const s=document.createElement("style");s.textContent=${JSON.stringify(HERO_PLAYER_CSS)};(document.head||document.documentElement).appendChild(s)})()`).catch(() => {})
            })
        })
    })
}

export function startLocalServer(): number {
    hideHeroPlayerControls()
    const server = http.createServer((req, res) => {
        const match = req.url?.match(/^\/player\/([\w-]+)/)
        if (!match) {
            res.writeHead(404)
            res.end("Not found")
            return
        }

        const id = match[1]
        let url = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&enablejsapi=1&autoplay=1&playsinline=1&modestbranding=1&rel=0e`
        if (id.startsWith("compact_")) {
            const videoID = id.substring(8)
            url = `https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1&controls=0&mute=1&disablekb=1&loop=1&vq=medium&playlist=${videoID}&cc_lang_pref=ja&enablejsapi=true`
        }
        // Trailer on anime pages: starts muted with English captions forced on, the page unmutes it on hover
        if (id.startsWith("inline_")) {
            const videoID = id.substring(7)
            url = `https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1&mute=1&loop=1&playlist=${videoID}&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
        }
        // Trailer in the anime page banner: plays once, muted, without controls
        if (id.startsWith("hero_")) {
            const videoID = id.substring(5)
            url = `https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1&controls=0&mute=1&disablekb=1&iv_load_policy=3&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
        }
        // Full trailer window opened from the banner: watch_<seconds>_<videoID>, with sound and controls
        const watch = id.match(/^watch_(\d+)_([\w-]+)$/)
        if (watch) {
            url = `https://www.youtube-nocookie.com/embed/${watch[2]}?autoplay=1&start=${watch[1]}&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
        }
        if (id.startsWith("play_")) {
            const videoID = id.substring(5)
            url = `https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1&cc_load_policy=1&cc_lang_pref=en&hl=en&rel=0&playsinline=1&enablejsapi=1`
        }
        if (id.startsWith("banner_")) {
            const videoID = id.substring(7)
            url = `https://www.youtube-nocookie.com/embed/${videoID}?autoplay=1&controls=0&mute=1&disablekb=1&loop=1&playlist=${videoID}&cc_lang_pref=ja&enablejsapi=true`
        }

        res.writeHead(200, { "Content-Type": "text/html" })
        res.end(`<!DOCTYPE html>
<html lang="en">
<head><style>html,body{margin:0;height:100%;background:black}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><iframe id="yt" src="${url}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
<script>
var yt=document.getElementById("yt");
window.__ytState=null;
window.__ytTime=0;
window.__ytDur=0;
window.__yt=function(f,a){yt.contentWindow&&yt.contentWindow.postMessage(JSON.stringify({event:"command",func:f,args:a||[]}),"*")};
window.__ytFullscreen=function(){(yt.requestFullscreen||yt.webkitRequestFullscreen).call(yt)};
function listen(){yt.contentWindow&&yt.contentWindow.postMessage(JSON.stringify({event:"listening",id:1,channel:"widget"}),"*")}
yt.addEventListener("load",function(){listen();setTimeout(listen,1000);setTimeout(listen,3000)});
window.addEventListener("message",function(e){try{var d=JSON.parse(e.data);if(d.event==="onStateChange")window.__ytState=d.info;else if(d.info){if(typeof d.info.playerState==="number")window.__ytState=d.info.playerState;if(typeof d.info.currentTime==="number")window.__ytTime=d.info.currentTime;if(typeof d.info.duration==="number")window.__ytDur=d.info.duration}}catch(_){}});
</script></body>
</html>`)
    })

    server.listen(0)
    localServerPort = (server.address() as AddressInfo).port
    console.log(`Local server running at http://${LOCAL_EMBED_HOST}:${localServerPort}`)
    return localServerPort
}
