import type { PartialDateTimeRange } from '@mannercode/common'

export class SearchShowtimesDto {
    endTimeRange?: PartialDateTimeRange

    movieIds?: string[]

    sagaIds?: string[]

    startTimeRange?: PartialDateTimeRange

    theaterIds?: string[]
}
