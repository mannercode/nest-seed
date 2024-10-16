import { IsOptional } from 'class-validator'

export class TicketFilterDto {
    @IsOptional()
    batchIds?: string[]

    @IsOptional()
    movieIds?: string[]

    @IsOptional()
    showtimeIds?: string[]

    @IsOptional()
    theaterIds?: string[]
}
