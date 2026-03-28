import { Type } from 'class-transformer'
import { IsArray, IsDate, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator'
import { MovieGenre, MovieRating } from '../models'

export class UpsertMovieDto {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    assetIds?: string[]

    @IsOptional()
    @IsString()
    director?: string

    @IsInt()
    @IsOptional()
    durationInSeconds?: number

    @IsArray()
    @IsEnum(MovieGenre, { each: true })
    @IsOptional()
    genres?: MovieGenre[]

    @IsOptional()
    @IsString()
    @MaxLength(5000)
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
