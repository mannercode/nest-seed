import { IsOptional } from 'class-validator'
import { PaginationOptionDto } from 'common'

export class ShowtimeQueryDto extends PaginationOptionDto {
    @IsOptional()
    movieId?: string

    @IsOptional()
    theaterId?: string

    @IsOptional()
    batchId?: string

    @IsOptional()
    showtimeIds?: string[]
}
