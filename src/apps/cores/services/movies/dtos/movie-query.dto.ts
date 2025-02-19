import { IsOptional } from 'class-validator'
import { PaginationOptionDto } from 'common'

export class MovieQueryDto extends PaginationOptionDto {
    @IsOptional()
    title?: string

    @IsOptional()
    genre?: string

    @IsOptional()
    releaseDate?: Date

    @IsOptional()
    plot?: string

    @IsOptional()
    director?: string

    @IsOptional()
    rating?: string
}
