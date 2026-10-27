import { MediaGenreSelector } from "@/app/(main)/_features/media/_components/media-genre-selector"
import { __discover_globalGenresAtom, __discover_hidePlanningAtom, __discover_hideWatchedAtom } from "@/app/(main)/discover/_lib/discover-filters"
import { ADVANCED_SEARCH_MEDIA_GENRES } from "@/app/(main)/search/_lib/advanced-search-constants"
import { Switch } from "@/components/ui/switch"
import { PrimitiveAtom } from "jotai"
import { useAtom } from "jotai/react"
import React from "react"

export function DiscoverFilterBar() {
    const [hideWatched, setHideWatched] = useAtom(__discover_hideWatchedAtom)
    const [hidePlanning, setHidePlanning] = useAtom(__discover_hidePlanningAtom)

    return (
        <div className="space-y-1 z-[5] relative" data-discover-filter-bar>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-2">
                <h2>Filters</h2>
                <Switch
                    label="Hide watched"
                    moreHelp="Hides anime you've completed, are watching, paused or dropped, here and in Recommendations on anime pages"
                    value={hideWatched}
                    onValueChange={setHideWatched}
                    fieldClass="w-fit"
                />
                <Switch
                    label="Also hide Planning"
                    value={hidePlanning}
                    onValueChange={setHidePlanning}
                    disabled={!hideWatched}
                    fieldClass="w-fit"
                />
            </div>
            <DiscoverGenreSelector atom={__discover_globalGenresAtom} />
            <p className="text-sm text-[--muted] px-2">Applies to every row set to "All".</p>
        </div>
    )
}

export function DiscoverGenreSelector({ atom }: { atom: PrimitiveAtom<string[]> }) {
    const [selectedGenre, setSelectedGenre] = useAtom(atom)

    return (
        <MediaGenreSelector
            items={[
                {
                    name: "All",
                    isCurrent: selectedGenre.length === 0,
                    onClick: () => setSelectedGenre([]),
                },
                ...ADVANCED_SEARCH_MEDIA_GENRES.map(genre => ({
                    name: genre,
                    isCurrent: selectedGenre.includes(genre),
                    onClick: () => setSelectedGenre([genre]),
                })),
            ]}
        />
    )
}
