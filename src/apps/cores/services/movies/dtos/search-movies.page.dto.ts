import { PaginationDto } from '@mannercode/nestlib-common'
import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator'
import { MovieGenre, MovieRating } from '../models'

export class SearchMoviesPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    director?: string

    @IsEnum(MovieGenre)
    @IsOptional()
    genre?: MovieGenre

    @IsOptional()
    @IsString()
    plot?: string

    @IsEnum(MovieRating)
    @IsOptional()
    rating?: MovieRating

    @IsDate()
    @IsOptional()
    @Type(() => Date)
    releaseDate?: Date

    @IsOptional()
    @IsString()
    title?: string
}
