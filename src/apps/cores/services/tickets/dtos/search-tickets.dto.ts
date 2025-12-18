import { IsArray, IsOptional, IsString } from 'class-validator'

export class SearchTicketsDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    sagaIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    movieIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    showtimeIds?: string[]

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    theaterIds?: string[]
}
