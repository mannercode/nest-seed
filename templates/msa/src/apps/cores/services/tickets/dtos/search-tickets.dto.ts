import { IsArray, IsOptional, IsString } from 'class-validator'

export class SearchTicketsDto {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    movieIds?: string[]

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    sagaIds?: string[]

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    showtimeIds?: string[]

    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    theaterIds?: string[]
}
