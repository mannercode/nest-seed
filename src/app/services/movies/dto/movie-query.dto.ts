import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class MovieQueryDto extends PaginationOption {
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
