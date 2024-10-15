import { IsOptional } from 'class-validator'
import { DateRange } from 'common'

// TODO 배열로 모두 바꿔라
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
