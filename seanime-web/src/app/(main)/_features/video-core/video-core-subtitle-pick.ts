import { detectTrackLanguage, isTrackLanguageMatch } from "@/lib/helpers/language"

// Which kind of English (or other language) track to prefer when a file has several
// "full": every line of dialogue, "signs": only signs, songs and on-screen text, "auto": the file's own forced/default flags
export type SubtitleTypePreference = "auto" | "full" | "signs"

export type SubtitlePickTrack = { label?: string, language?: string, number: number, forced?: boolean, default?: boolean }

// The user's last manual pick for a show, re-applied on the next episodes
export type RememberedSubtitlePick = {
    off?: boolean
    language?: string
    label?: string
    forced?: boolean
    // Position among the tracks sharing the same name, to tell apart e.g. two tracks both called "English"
    sameLabelIndex?: number
}

// Names that say the track has all the dialogue, checked first so "Full + Songs" or "Non-Forced" don't count as signs
const FULL_RE = /\b(full|dialogue|complete|non[\s-]?forced|unforced|no\s+signs|without\s+signs)\b/i
const SIGNS_RE = /\b(signs?|songs?|forced|lyrics?|karaoke|s\s*&\s*s|s\/s)\b/i

export function isSignsTrack(track: { label?: string, forced?: boolean }) {
    const label = track.label ?? ""
    if (FULL_RE.test(label)) return false
    return !!track.forced || SIGNS_RE.test(label)
}

// Stable order: tracks of the wanted type first, otherwise keep the file's order
export function sortByTypePreference<T extends SubtitlePickTrack>(tracks: T[], type: SubtitleTypePreference | undefined): T[] {
    if (!type || type === "auto") return tracks
    const wantSigns = type === "signs"
    return [...tracks].sort((a, b) => Number(isSignsTrack(b) === wantSigns) - Number(isSignsTrack(a) === wantSigns))
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const STORAGE_KEY = "sea-video-core-subtitle-pick-by-media"

function readAll(): Record<string, RememberedSubtitlePick> {
    try {
        const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
        return parsed && typeof parsed === "object" ? parsed as Record<string, RememberedSubtitlePick> : {}
    }
    catch {
        return {}
    }
}

export function getRememberedSubtitlePick(mediaId: number | string | null | undefined): RememberedSubtitlePick | undefined {
    if (mediaId == null) return undefined
    return readAll()[String(mediaId)]
}

export function rememberSubtitlePick(mediaId: number | string | null | undefined, selection: Omit<RememberedSubtitlePick, "off"> | null) {
    if (mediaId == null) return
    try {
        const all = readAll()
        all[String(mediaId)] = selection
            ? {
                language: selection.language,
                label: selection.label,
                forced: selection.forced,
                sameLabelIndex: selection.sameLabelIndex,
            }
            : { off: true }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
    }
    catch {}
}

export function forgetSubtitlePicks() {
    try {
        localStorage.removeItem(STORAGE_KEY)
    }
    catch {}
}

function normalize(value?: string | null) {
    return value?.trim().toLowerCase() ?? ""
}

// Finds the track matching a remembered pick. Release groups keep the same track names across episodes,
// so the exact name comes first. If the name changed, it falls back to the same kind of track in the same language.
// Returns null when nothing fits, so the general preferences decide.
export function findRememberedTrack<T extends SubtitlePickTrack>(tracks: T[], pick: RememberedSubtitlePick | undefined): T | null {
    if (!pick || pick.off) return null
    const label = normalize(pick.label)
    const language = normalize(pick.language) || detectTrackLanguage({ label: pick.label }) || ""
    const sameLanguage = (t: T) => !language || isTrackLanguageMatch({ language: t.language, label: t.label }, language)

    if (label || pick.sameLabelIndex != null) {
        const sameLabel = tracks.filter(t => normalize(t.label) === label && sameLanguage(t))
        if (sameLabel.length) {
            const byForced = pick.forced != null ? sameLabel.filter(t => !!t.forced === pick.forced) : sameLabel
            const pool = byForced.length ? byForced : sameLabel
            const index = pick.sameLabelIndex ?? 0
            return pool.length === sameLabel.length ? (sameLabel[index] ?? sameLabel[0]) : pool[0]
        }
    }

    // Without a language the fallback would match tracks in any language, leave it to the preferences
    if (!language) return null
    const wantSigns = isSignsTrack({ label: pick.label, forced: pick.forced })
    return tracks.find(t => sameLanguage(t) && isSignsTrack(t) === wantSigns) ?? null
}
