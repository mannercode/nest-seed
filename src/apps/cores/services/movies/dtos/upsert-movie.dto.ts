import { Type } from 'class-transformer'
import { IsArray, IsDate, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator'
import { MovieGenre, MovieRating } from '../models'

export class UpsertMovieDto {
    @IsString()
    @IsOptional()
    title?: string

    @IsArray()
    @IsEnum(MovieGenre, { each: true })
    @IsOptional()
    genres?: MovieGenre[]

    @IsDate()
    @Type(() => Date)
    @IsOptional()
    releaseDate?: Date

    @IsString()
    @MaxLength(5000)
    @IsOptional()
    plot?: string

    @IsInt()
    @IsOptional()
    durationInSeconds?: number

    @IsString()
    @IsOptional()
    director?: string

    @IsEnum(MovieRating)
    @IsOptional()
    rating?: MovieRating

    @IsArray()
    @IsString({ each: true })
    @IsOptional()
    assetIds?: string[]
}
