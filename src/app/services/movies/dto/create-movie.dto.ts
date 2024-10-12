import { Transform, Type } from 'class-transformer'
import { IsArray, IsDate, IsEnum, IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { MovieGenre, MovieRating } from '../schemas'

export class CreateMovieDto {
    @IsString()
    @IsNotEmpty()
    title: string

    @IsArray()
    @IsEnum(MovieGenre, { each: true })
    @Transform(({ value }) => {
        if (Array.isArray(value)) return value

        const genres = JSON.parse(value)
        return genres.map((genre: string) => genre as MovieGenre)
    })
    genre: MovieGenre[]

    @IsDate()
    @Type(() => Date)
    releaseDate: Date

    @IsString()
    @MaxLength(5000)
    plot: string

    @IsInt()
    durationMinutes: number

    @IsString()
    director: string

    @IsEnum(MovieRating)
    rating: MovieRating
}
