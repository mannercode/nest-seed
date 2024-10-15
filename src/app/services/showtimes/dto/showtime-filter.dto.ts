import { IsOptional } from 'class-validator'
import { DateRange } from 'common'

export class ShowtimeFilterDto {
    @IsOptional()
    batchId?: string

    @IsOptional()
    movieId?: string

    @IsOptional()
    theaterId?: string

    @IsOptional()
    startTimeRange?: DateRange
}
