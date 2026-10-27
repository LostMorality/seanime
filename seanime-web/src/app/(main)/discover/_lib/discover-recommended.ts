import { AL_AnimeCollection, AL_BaseAnime } from "@/api/generated/types"
import { useAnilistListAnime, useGetAnimeCollection } from "@/api/hooks/anilist.hooks"
import { useDiscoverGenres, useDiscoverListIds } from "@/app/(main)/discover/_lib/discover-filters"
import { __discover_recommendedGenresAtom } from "@/app/(main)/discover/_lib/handle-discover-queries"
import { useInView } from "motion/react"
import React from "react"

const PROFILE_GENRE_COUNT = 3
const MAX_RESULTS = 20
// Shows older than this get no freshness boost
const FRESHNESS_YEARS = 12

type GenreProfile = {
    weights: Map<string, number>
    topGenres: string[]
}

/**
 * Weighs each genre by how much of it the user watched, scaled by how they scored it compared to their average.
 * Dropped anime count against their genres.
 */
function buildGenreProfile(collection: AL_AnimeCollection | undefined): GenreProfile {
    const entries = collection?.MediaListCollection?.lists?.flatMap(list => list?.entries ?? []) ?? []

    const scores = entries.map(e => e?.score ?? 0).filter(s => s > 0)
    const meanScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0

    const weights = new Map<string, number>()
    for (const entry of entries) {
        if (!entry?.media?.genres?.length || !entry.status || entry.status === "PLANNING") continue

        let weight = entry.status === "DROPPED" ? -0.5 : 1
        if (weight > 0 && meanScore > 0 && entry.score) {
            weight *= Math.min(2, Math.max(0.3, entry.score / meanScore))
        }
        for (const genre of entry.media.genres) {
            weights.set(genre, (weights.get(genre) ?? 0) + weight)
        }
    }

    const topGenres = [...weights.entries()]
        .filter(([, w]) => w > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, PROFILE_GENRE_COUNT)
        .map(([genre]) => genre)

    return { weights, topGenres }
}

/**
 * Well-rated anime in the user's favorite genres that aren't on their list yet, leaning towards newer shows.
 * Uses one AniList request; everything else comes from the cached anime collection.
 */
export function useDiscoverRecommendedAnime(ref: React.RefObject<HTMLElement | null>) {
    const isInView = useInView(ref, { once: true })
    const { data: animeCollection } = useGetAnimeCollection()
    const { all: onListIds } = useDiscoverListIds()

    const profile = React.useMemo(() => buildGenreProfile(animeCollection), [animeCollection])
    const selectedGenres = useDiscoverGenres(__discover_recommendedGenresAtom)
    const genres = selectedGenres ?? profile.topGenres

    const { data, isLoading } = useAnilistListAnime({
        page: 1,
        perPage: 50,
        // What people are watching now, so the pool isn't only all-time classics
        sort: ["TRENDING_DESC", "POPULARITY_DESC"],
        status: ["RELEASING", "FINISHED"],
        averageScore_greater: 70,
        genres,
        isAdult: false,
    }, isInView && genres.length > 0)

    const media = React.useMemo(() => {
        const maxWeight = Math.max(1, ...profile.weights.values())
        const thisYear = new Date().getFullYear()
        const rank = (m: AL_BaseAnime) => {
            const genreFit = (m.genres ?? []).reduce((sum, g) => sum + Math.max(0, profile.weights.get(g) ?? 0), 0) / maxWeight
            const year = m.startDate?.year ?? m.seasonYear ?? thisYear - FRESHNESS_YEARS
            const freshness = Math.min(1, Math.max(0, 1 - (thisYear - year) / FRESHNESS_YEARS))
            return genreFit * 0.5 + ((m.meanScore ?? 0) / 100) * 0.3 + freshness * 0.2
        }
        return (data?.Page?.media ?? [])
            .filter((m): m is AL_BaseAnime => !!m && !onListIds.has(m.id))
            .sort((a, b) => rank(b) - rank(a))
            .slice(0, MAX_RESULTS)
    }, [data, onListIds, profile])

    return {
        media,
        isLoading: isLoading || !animeCollection || (!data && genres.length > 0),
        topGenres: profile.topGenres,
        hasProfile: profile.topGenres.length > 0,
    }
}
