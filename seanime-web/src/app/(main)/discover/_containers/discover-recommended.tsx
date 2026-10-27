import { MediaEntryCard } from "@/app/(main)/_features/media/_components/media-entry-card"
import { MediaEntryCardSkeleton } from "@/app/(main)/_features/media/_components/media-entry-card-skeleton"
import { DiscoverGenreSelector } from "@/app/(main)/discover/_components/discover-filter-bar"
import { useDiscoverRecommendedAnime } from "@/app/(main)/discover/_lib/discover-recommended"
import { __discover_recommendedGenresAtom } from "@/app/(main)/discover/_lib/handle-discover-queries"
import { Carousel, CarouselContent, CarouselDotButtons } from "@/components/ui/carousel"
import { useAtomValue } from "jotai/react"
import React from "react"

export function DiscoverRecommended() {

    const ref = React.useRef<HTMLDivElement>(null)
    const { media, isLoading, topGenres, hasProfile } = useDiscoverRecommendedAnime(ref)
    const selectedGenres = useAtomValue(__discover_recommendedGenresAtom)

    return (
        <div className="space-y-2 z-[5] relative" data-discover-page-anime-recommended-container>
            <h2>Recommended for You</h2>
            {hasProfile && !selectedGenres.length && <p className="text-[--muted] px-2">
                Because you like {topGenres.join(", ")}
            </p>}
            <Carousel
                className="w-full max-w-full"
                gap="xl"
                opts={{
                    align: "start",
                    dragFree: true,
                }}
                autoScroll
            >
                <DiscoverGenreSelector atom={__discover_recommendedGenresAtom} />
                <CarouselDotButtons flag={media} />
                <CarouselContent className="px-6" ref={ref}>
                    {isLoading ? [...Array(10).keys()].map((v, idx) => <MediaEntryCardSkeleton key={idx} />)
                        : media.map(media => {
                            return (
                                <MediaEntryCard
                                    key={media.id}
                                    media={media}
                                    showLibraryBadge
                                    containerClassName="basis-[200px] md:basis-[250px] mx-2 mt-8 mb-0"
                                    showTrailer
                                    type="anime"
                                />
                            )
                        })}
                </CarouselContent>
            </Carousel>
            {!isLoading && !media.length && <p className="text-[--muted] px-2">
                {hasProfile ? "Nothing new to recommend in these genres." : "Watch and rate a few anime to get recommendations."}
            </p>}
        </div>
    )
}
