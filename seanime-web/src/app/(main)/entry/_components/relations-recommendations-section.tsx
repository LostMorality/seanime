import { AL_AnimeDetailsById_Media, Anime_Entry, Nullish } from "@/api/generated/types"
import { useGetAnilistAnimeRecommendations } from "@/api/hooks/anilist.hooks"
import { MediaCardGrid } from "@/app/(main)/_features/media/_components/media-card-grid"
import { MediaEntryCard } from "@/app/(main)/_features/media/_components/media-entry-card"
import { MediaEntryDetailsSkeleton } from "@/app/(main)/_features/media/_components/media-entry-page-loading-display"
import { useServerStatus } from "@/app/(main)/_hooks/use-server-status"
import { useDiscoverMediaFilter } from "@/app/(main)/discover/_lib/discover-filters"
import capitalize from "lodash/capitalize"
import React from "react"

type RelationsRecommendationsSectionProps = {
    entry: Nullish<Anime_Entry>
    details: Nullish<AL_AnimeDetailsById_Media>
    loading?: boolean
    containerRef?: React.RefObject<HTMLElement | null>
    maxCol?: number
}

export function RelationsRecommendationsSection(props: RelationsRecommendationsSectionProps) {

    const {
        entry,
        details,
        loading,
        containerRef,
        maxCol,
        ...rest
    } = props

    const serverStatus = useServerStatus()

    const sourceManga = React.useMemo(() => {
        return serverStatus?.settings?.library?.enableManga
            ? details?.relations?.edges?.find(edge => (edge?.relationType === "SOURCE" || edge?.relationType === "ADAPTATION") && edge?.node?.format === "MANGA")?.node
            : undefined
    }, [details?.relations?.edges, serverStatus?.settings?.library?.enableManga])

    const relations = React.useMemo(() => (details?.relations?.edges?.map(edge => edge) || [])
            .filter(Boolean)
            .filter(n => (n.node?.format !== "MANGA" && n.node?.format !== "ONE_SHOT" && n.node?.format !== "NOVEL" && n.node?.format !== "MUSIC" && n.relationType !== "CHARACTER")),
        [details?.relations?.edges])

    // Follows the Discover page's "Hide watched" switches
    const filterMedia = useDiscoverMediaFilter()
    const topRecommendations = React.useMemo(() => filterMedia(details?.recommendations?.edges?.map(edge => edge?.node?.mediaRecommendation)),
        [details?.recommendations?.edges, filterMedia])

    // The details only carry the top 8, so fetch more when most of them got hidden
    const shownCount = details?.recommendations?.edges?.length ?? 0
    const needsMore = shownCount > 0 && topRecommendations.length < Math.min(4, shownCount)
    const { data: moreRecommendations } = useGetAnilistAnimeRecommendations(details?.id, needsMore)

    const recommendations = React.useMemo(() => {
        if (!needsMore || !moreRecommendations) return topRecommendations
        return filterMedia(moreRecommendations).filter(m => m.id !== details?.id).slice(0, shownCount)
    }, [needsMore, moreRecommendations, topRecommendations, filterMedia, details?.id, shownCount])

    if (loading && !details) return <MediaEntryDetailsSkeleton showCharacters={false} />
    if (!entry || !details) return null

    return (
        <div className="space-y-4 animate-in fade-in-0 duration-200">
            {/*{(!!sourceManga || relations.length > 0 || recommendations.length > 0) && <Separator />}*/}
            {(!!sourceManga || relations.length > 0) && (
                <>
                    <h2>Relations</h2>
                    <MediaCardGrid maxCol={maxCol}>
                        {!!sourceManga && <div className="col-span-1">
                            <MediaEntryCard
                                media={sourceManga!}
                                overlay={<p
                                    className="font-semibold text-white bg-gray-950 z-[-1] absolute right-0 w-fit px-4 py-1.5 text-center !bg-opacity-90 text-sm lg:text-base rounded-none rounded-bl-lg"
                                >Manga</p>}
                                type="manga"
                            /></div>}
                        {relations.slice(0, 4).map(edge => {
                            return <div key={edge.node?.id} className="col-span-1">
                                <MediaEntryCard
                                    media={edge.node!}
                                    overlay={<p
                                        className="font-semibold text-white bg-gray-950 z-[-1] absolute right-0 w-fit px-4 py-1.5 text-center !bg-opacity-90 text-sm lg:text-base rounded-none rounded-bl-lg"
                                    >{edge.node?.format === "MOVIE"
                                        ? capitalize(edge.relationType || "").replace("_", " ") + " (Movie)"
                                        : capitalize(edge.relationType || "").replace("_", " ")}</p>}
                                    showLibraryBadge
                                    showTrailer
                                    type="anime"
                                />
                            </div>
                        })}
                    </MediaCardGrid>
                </>
            )}
            {recommendations.length > 0 && <>
                <h2>Recommendations</h2>
                <MediaCardGrid maxCol={maxCol}>
                    {recommendations.map(media => {
                        return <div key={media.id} className="col-span-1">
                            <MediaEntryCard
                                media={media!}
                                showLibraryBadge
                                showTrailer
                                type="anime"
                            />
                        </div>
                    })}
                </MediaCardGrid>
            </>}
        </div>
    )
}
