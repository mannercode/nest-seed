import { IsOptional } from 'class-validator'

export class AggregateTicketSalesDto {
    @IsOptional()
    showtimeIds?: string[]
}
