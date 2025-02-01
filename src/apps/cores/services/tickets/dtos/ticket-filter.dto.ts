import { IsOptional } from 'class-validator'
import { BaseDto } from 'common'

export class TicketFilterDto extends BaseDto {
    @IsOptional()
    batchIds?: string[]

    @IsOptional()
    movieIds?: string[]

    @IsOptional()
    showtimeIds?: string[]

    @IsOptional()
    theaterIds?: string[]
}
