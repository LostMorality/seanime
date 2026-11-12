import React from "react"

export const VC_HDR_GAMMA_FILTER_ID = "vc-hdr-gamma-fix"
export const VC_HDR_GAMMA_FILTER = `url(#${VC_HDR_GAMMA_FILTER_ID})`

// With HDR on, Windows decodes SDR video with the piecewise sRGB curve, while anime is mastered for gamma 2.2.
// That lifts the shadows into grey. Encoding each value as srgb(x^2.2) makes the displayed light match gamma 2.2.
function srgbEncode(linear: number) {
    return linear <= 0.0031308 ? 12.92 * linear : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
}

const tableValues = Array.from({ length: 256 }, (_, i) => srgbEncode(Math.pow(i / 255, 2.2)).toFixed(5)).join(" ")

// Referenced by the video's CSS filter and by the PiP canvas (ctx.filter), so it has to stay in the document
export function VideoCoreHdrGammaFilter() {
    return (
        <svg width="0" height="0" aria-hidden style={{ position: "absolute", pointerEvents: "none" }}>
            <filter id={VC_HDR_GAMMA_FILTER_ID} colorInterpolationFilters="sRGB">
                <feComponentTransfer>
                    <feFuncR type="table" tableValues={tableValues} />
                    <feFuncG type="table" tableValues={tableValues} />
                    <feFuncB type="table" tableValues={tableValues} />
                </feComponentTransfer>
            </filter>
        </svg>
    )
}

const hdrQuery = "(dynamic-range: high)"

export function useIsHdrDisplay() {
    const [isHdr, setIsHdr] = React.useState(() => typeof window !== "undefined" && window.matchMedia(hdrQuery).matches)

    React.useEffect(() => {
        const mql = window.matchMedia(hdrQuery)
        const onChange = () => setIsHdr(mql.matches)
        onChange()
        mql.addEventListener("change", onChange)
        return () => mql.removeEventListener("change", onChange)
    }, [])

    return isHdr
}
