import { Transform, Type } from 'class-transformer'
import {
    ArrayNotEmpty,
    IsArray,
    IsDate,
    IsEnum,
    IsInt,
    IsNotEmpty,
    IsString,
    MaxLength
} from 'class-validator'

import { MovieGenre, MovieRating } from '../models'

export class CreateMovieDto {
    @IsString()
    @IsNotEmpty()
    title: string

    @IsArray()
    @IsEnum(MovieGenre, { each: true })
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value

        const genres = JSON.parse(value)
        return genres.map((genres: string) => genres as MovieGenre)
    })
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
    @ArrayNotEmpty()
    @IsString({ each: true })
    imageAssetIds: string[]
}
