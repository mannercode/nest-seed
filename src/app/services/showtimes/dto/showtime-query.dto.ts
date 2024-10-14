import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class ShowtimeQueryDto extends PaginationOption {
    @IsOptional()
    movieId?: string

    @IsOptional()
    theaterId?: string

    @IsOptional()
    batchId?: string

    @IsOptional()
    showtimeIds?: string[]
}
