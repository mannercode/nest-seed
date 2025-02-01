import { IsOptional } from 'class-validator'
import { BaseDto, DateRange } from 'common'

export class ShowtimeFilterDto extends BaseDto {
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
