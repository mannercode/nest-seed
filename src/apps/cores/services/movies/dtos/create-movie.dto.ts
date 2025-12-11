import { Type } from 'class-transformer'
import { IsArray, IsDate, IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator'

import { MovieGenre, MovieRating } from '../models'

export class CreateMovieDto {
    @IsString()
    @IsNotEmpty()
    title: string

    @IsArray()
    @IsEnum(MovieGenre, { each: true })
    genres: MovieGenre[]

    @IsDate()
    @Type(() => Date)
    releaseDate: Date

    @IsString()
    @MaxLength(5000)
    plot: string

    @IsInt()
    durationInSeconds: number

    @IsString()
    director: string

    @IsEnum(MovieRating)
    rating: MovieRating

    @IsArray()
    @IsString({ each: true })
    assetIds: string[]
}
