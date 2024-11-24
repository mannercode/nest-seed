import { IsOptional } from 'class-validator'

export class MovieFilterDto {
    @IsOptional()
    movieIds?: string[]
}
