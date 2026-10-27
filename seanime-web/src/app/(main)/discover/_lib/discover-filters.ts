import { AL_MediaListStatus } from "@/api/generated/types"
import { useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { useGetRawAnilistMangaCollection } from "@/api/hooks/manga.hooks"
import { PrimitiveAtom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { useAtomValue } from "jotai/react"
import React from "react"

// Applies to every row whose own genre selector is on "All"
export const __discover_globalGenresAtom = atomWithStorage<string[]>("sea-discover-global-genres", [], undefined, { getOnInit: true })
export const __discover_hideWatchedAtom = atomWithStorage<boolean>("sea-discover-hide-watched", true, undefined, { getOnInit: true })
export const __discover_hidePlanningAtom = atomWithStorage<boolean>("sea-discover-hide-planning", true, undefined, { getOnInit: true })

const WATCHED_STATUSES: AL_MediaListStatus[] = ["CURRENT", "COMPLETED", "REPEATING", "PAUSED", "DROPPED"]

type MediaLike = { id: number, genres?: string[] }

/**
 * Returns the genres a row should query: its own selection, or the page-wide one when the row is on "All".
 */
export function useDiscoverGenres(rowAtom?: PrimitiveAtom<string[]>) {
    const globalGenres = useAtomValue(__discover_globalGenresAtom)
    const rowGenres = useAtomValue(rowAtom ?? __discover_globalGenresAtom)
    const genres = rowGenres.length > 0 ? rowGenres : globalGenres
    return genres.length > 0 ? genres : undefined
}

/**
 * Rows ask for more results while hiding watched anime, so they don't end up nearly empty.
 * It's still a single AniList request.
 */
export function useDiscoverPerPage() {
    const hideWatched = useAtomValue(__discover_hideWatchedAtom)
    return hideWatched ? 50 : 20
}

/**
 * IDs of everything on the user's anime list, grouped into what "Hide watched" removes and the rest.
 */
export function useDiscoverListIds() {
    const { data: animeCollection } = useGetAnimeCollection()
    return React.useMemo(() => groupListIds(animeCollection), [animeCollection])
}

type ListCollectionLike = {
    MediaListCollection?: {
        lists?: ({ entries?: ({ status?: AL_MediaListStatus, media?: { id: number } } | null | undefined)[] } | null | undefined)[]
    }
} | undefined

function groupListIds(collection: ListCollectionLike) {
    const watched = new Set<number>()
    const planning = new Set<number>()
    const all = new Set<number>()
    for (const list of collection?.MediaListCollection?.lists ?? []) {
        for (const entry of list?.entries ?? []) {
            const id = entry?.media?.id
            if (!id) continue
            all.add(id)
            if (entry.status === "PLANNING") planning.add(id)
            else if (entry.status && WATCHED_STATUSES.includes(entry.status)) watched.add(id)
        }
    }
    return { watched, planning, all, isLoaded: !!collection }
}

/**
 * Returns a function that drops anime hidden by the page filters.
 * Pass `genres` for rows whose data isn't already queried by genre.
 */
export function useDiscoverMediaFilter() {
    const { watched, planning } = useDiscoverListIds()
    return useListFilter(watched, planning)
}

/**
 * Same as useDiscoverMediaFilter, for manga: drops manga being read or already read (and Planning) per the same switches.
 */
export function useMangaListMediaFilter() {
    const { data: mangaCollection } = useGetRawAnilistMangaCollection()
    const { watched, planning } = React.useMemo(() => groupListIds(mangaCollection as ListCollectionLike), [mangaCollection])
    return useListFilter(watched, planning)
}

function useListFilter(watched: Set<number>, planning: Set<number>) {
    const hideWatched = useAtomValue(__discover_hideWatchedAtom)
    const hidePlanning = useAtomValue(__discover_hidePlanningAtom)

    return React.useCallback(<T extends MediaLike>(media: (T | null | undefined)[] | undefined, genres?: string[]): T[] => {
        return (media ?? []).filter((m): m is T => {
            if (!m) return false
            if (hideWatched && watched.has(m.id)) return false
            if (hideWatched && hidePlanning && planning.has(m.id)) return false
            if (genres?.length && !genres.some(g => m.genres?.includes(g))) return false
            return true
        })
    }, [hideWatched, hidePlanning, watched, planning])
}
