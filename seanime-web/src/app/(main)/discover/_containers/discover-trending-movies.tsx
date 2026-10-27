import { MediaEntryCard } from "@/app/(main)/_features/media/_components/media-entry-card"
import { useDiscoverMediaFilter } from "@/app/(main)/discover/_lib/discover-filters"
import { MediaEntryCardSkeleton } from "@/app/(main)/_features/media/_components/media-entry-card-skeleton"
import { __discover_trendingMoviesGenresAtom, useDiscoverTrendingMovies } from "@/app/(main)/discover/_lib/handle-discover-queries"
import { DiscoverGenreSelector } from "@/app/(main)/discover/_components/discover-filter-bar"
import { Carousel, CarouselContent, CarouselDotButtons } from "@/components/ui/carousel"
import React from "react"

export function DiscoverTrendingMovies() {

    const ref = React.useRef<HTMLDivElement>(null)
    const { data, isLoading } = useDiscoverTrendingMovies(ref)
    const filterMedia = useDiscoverMediaFilter()

    return (
        <Carousel
            className="w-full max-w-full"
            gap="xl"
            opts={{
                align: "start",
                dragFree: true,
            }}
            autoScroll
        >
            {/*<CarouselMasks />*/}
            <DiscoverGenreSelector atom={__discover_trendingMoviesGenresAtom} />
            <CarouselDotButtons />
            <CarouselContent className="px-6" ref={ref}>
                {!!data ? filterMedia(data?.Page?.media).map(media => {
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
                }) : [...Array(10).keys()].map((v, idx) => <MediaEntryCardSkeleton key={idx} />)}
            </CarouselContent>
        </Carousel>
    )
}
