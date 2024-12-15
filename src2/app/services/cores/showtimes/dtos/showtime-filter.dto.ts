import { IsOptional } from 'class-validator'
import { DateRange } from 'common'

export class ShowtimeFilterDto {
    @IsOptional()
    batchIds?: string[]

    @IsOptional()
    movieIds?: string[]

    @IsOptional()
    theaterIds?: string[]

    @IsOptional()
    startTimeRange?: DateRange

    @IsOptional()
    endTimeRange?: DateRange
}
