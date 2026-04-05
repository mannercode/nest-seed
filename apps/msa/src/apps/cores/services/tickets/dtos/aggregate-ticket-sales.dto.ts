import { IsArray, IsOptional, IsString } from 'class-validator'

export class AggregateTicketSalesDto {
    @IsArray()
    @IsOptional()
    @IsString({ each: true })
    showtimeIds?: string[]
}
