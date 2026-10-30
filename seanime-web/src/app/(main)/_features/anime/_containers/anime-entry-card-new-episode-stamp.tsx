import { AL_BaseAnime, AL_MediaListStatus, Nullish } from "@/api/generated/types"
import { cn } from "@/components/ui/core/styling"
import { useAtomValue } from "jotai/react"
import { atomWithStorage } from "jotai/utils"
import React from "react"

export const __ui_newEpisodeStampAtom = atomWithStorage<boolean>("sea-ui-new-episode-stamp", true, undefined, { getOnInit: true })

type AnimeEntryCardNewEpisodeStampProps = {
    media: Nullish<AL_BaseAnime>
    progress: Nullish<number>
    listStatus: Nullish<AL_MediaListStatus>
}

/**
 * Shown on airing anime you're watching when an episode you haven't seen yet is out.
 */
export function AnimeEntryCardNewEpisodeStamp(props: AnimeEntryCardNewEpisodeStampProps) {
    const { media, progress, listStatus } = props
    const enabled = useAtomValue(__ui_newEpisodeStampAtom)

    if (!enabled || !media || media.status !== "RELEASING") return null
    // Rewatch progress starts over, so on REPEATING the gap is episodes already seen, not new ones
    if (listStatus !== "CURRENT") return null

    // Without a next episode, `episodes` is the planned total, not what has aired
    if (!media.nextAiringEpisode?.episode) return null

    const unwatched = media.nextAiringEpisode.episode - 1 - (progress ?? 0)
    if (unwatched <= 0) return null

    return (
        <div
            data-anime-entry-card-new-episode-stamp
            className="absolute inset-0 z-[9] overflow-hidden pointer-events-none select-none"
        >
            {/* Sash across the cover, wider than the card so its ends get clipped by the corners */}
            <div
                className={cn(
                    "absolute left-[-30%] w-[160%] top-[30%] -rotate-[22deg]",
                    "flex flex-col items-center py-1 text-white leading-none whitespace-nowrap",
                    "bg-gradient-to-r from-rose-700/95 via-rose-600/95 to-orange-500/95",
                    "border-y-2 border-white/70 shadow-[0_4px_14px_rgba(0,0,0,0.55)]",
                )}
            >
                <span
                    className="text-[1.05rem] font-black tracking-[0.12em] pl-[0.12em] [text-shadow:0_1px_3px_rgba(0,0,0,0.6)]"
                    style={{ fontFamily: "\"Yu Gothic UI\", \"Yu Gothic\", \"Hiragino Sans\", \"Noto Sans JP\", Meiryo, sans-serif" }}
                >
                    {/* Same wording as the English line: "new episode", and "new episodes: 3" */}
                    {unwatched > 1 ? `新エピソード ${unwatched}話` : "新エピソード"}
                </span>
                <span className="text-[0.6rem] font-extrabold tracking-[0.25em] pl-[0.25em] mt-[3px]">
                    {unwatched > 1 ? `${unwatched} NEW EPISODES` : "NEW EPISODE"}
                </span>
            </div>
        </div>
    )
}
