import { Type } from 'class-transformer'
import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator'
import { PaginationDto } from 'common'
import { MovieGenre, MovieRating } from '../models'

export class SearchMoviesPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    title?: string

    @IsOptional()
    @IsEnum(MovieGenre)
    genre?: MovieGenre

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    releaseDate?: Date

    @IsOptional()
    @IsString()
    plot?: string

    @IsOptional()
    @IsString()
    director?: string

    @IsOptional()
    @IsEnum(MovieRating)
    rating?: MovieRating
}
