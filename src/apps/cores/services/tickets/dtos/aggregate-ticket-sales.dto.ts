import { IsArray, IsOptional, IsString } from 'class-validator'

export class AggregateTicketSalesDto {
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    showtimeIds?: string[]
}
