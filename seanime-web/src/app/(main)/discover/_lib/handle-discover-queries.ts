import { AL_MediaSeason } from "@/api/generated/types"
import { useAnilistListAnime } from "@/api/hooks/anilist.hooks"
import { useDiscoverGenres, useDiscoverPerPage } from "@/app/(main)/discover/_lib/discover-filters"
import { atom } from "jotai"
import { useInView } from "motion/react"

export const __discover_trendingGenresAtom = atom<string[]>([])
export const __discover_currentSeasonGenresAtom = atom<string[]>([])
export const __discover_pastSeasonGenresAtom = atom<string[]>([])
export const __discover_upcomingGenresAtom = atom<string[]>([])
export const __discover_trendingMoviesGenresAtom = atom<string[]>([])
export const __discover_recommendedGenresAtom = atom<string[]>([])

export function useDiscoverTrendingAnime() {
    const genres = useDiscoverGenres(__discover_trendingGenresAtom)
    const perPage = useDiscoverPerPage()

    return useAnilistListAnime({
        page: 1,
        perPage,
        sort: ["TRENDING_DESC"],
        genres,
    }, true)

}

export function useDiscoverCurrentSeasonAnime(ref: any) {
    const genres = useDiscoverGenres(__discover_currentSeasonGenresAtom)
    const perPage = useDiscoverPerPage()
    const isInView = useInView(ref, { once: true })
    const currentMonth = new Date().getMonth() + 1
    let currentYear = new Date().getFullYear()
    let season: AL_MediaSeason = "SUMMER"
    switch (currentMonth) {
        case 1:
        case 2:
        case 3:
            season = "WINTER"
            break
        case 4:
        case 5:
        case 6:
            season = "SPRING"
            break
        case 7:
        case 8:
        case 9:
            season = "SUMMER"
            break
        case 10:
        case 11:
        case 12:
            season = "FALL"
            break
    }


    return useAnilistListAnime({
        page: 1,
        perPage,
        sort: ["SCORE_DESC"],
        season: season,
        seasonYear: currentYear,
        genres,
    }, isInView)
}

export function useDiscoverPastSeasonAnime(ref: any) {
    const genres = useDiscoverGenres(__discover_pastSeasonGenresAtom)
    const perPage = useDiscoverPerPage()
    const isInView = useInView(ref, { once: true })
    const currentMonth = new Date().getMonth() + 1
    const currentYear = new Date().getFullYear()
    let season: AL_MediaSeason = "SUMMER"
    switch (currentMonth) {
        case 1:
        case 2:
        case 3:
            season = "WINTER"
            break
        case 4:
        case 5:
        case 6:
            season = "SPRING"
            break
        case 7:
        case 8:
        case 9:
            season = "SUMMER"
            break
        case 10:
        case 11:
        case 12:
            season = "FALL"
            break
    }
    const pastSeason = season === "WINTER" ? "FALL" : season === "SPRING" ? "WINTER" : season === "SUMMER" ? "SPRING" : "SUMMER"
    const pastYear = season === "WINTER" ? currentYear - 1 : currentYear

    return useAnilistListAnime({
        page: 1,
        perPage,
        sort: ["SCORE_DESC"],
        season: pastSeason,
        seasonYear: pastYear,
        genres,
    }, isInView)
}

export function useDiscoverUpcomingAnime(ref: any) {
    const genres = useDiscoverGenres(__discover_upcomingGenresAtom)
    const perPage = useDiscoverPerPage()
    const isInView = useInView(ref, { once: true })
    return useAnilistListAnime({
        page: 1,
        perPage,
        sort: ["TRENDING_DESC"],
        status: ["NOT_YET_RELEASED"],
        genres,
    }, isInView)
}

export function useDiscoverPopularAnime(ref: any) {
    const perPage = useDiscoverPerPage()
    const isInView = useInView(ref, { once: true })
    return useAnilistListAnime({
        page: 1,
        perPage,
        sort: ["POPULARITY_DESC"],
    }, isInView)
}

export function useDiscoverTrendingMovies(ref: any) {
    const genres = useDiscoverGenres(__discover_trendingMoviesGenresAtom)
    const perPage = useDiscoverPerPage()
    const isInView = useInView(ref, { once: true })
    return useAnilistListAnime({
        page: 1,
        perPage,
        format: "MOVIE",
        sort: ["TRENDING_DESC"],
        status: ["RELEASING", "FINISHED"],
        genres,
    }, isInView)
}
