import { IsOptional } from 'class-validator'

export class QueryCustomersDto {
    @IsOptional()
    name?: string

    @IsOptional()
    email?: string
}
