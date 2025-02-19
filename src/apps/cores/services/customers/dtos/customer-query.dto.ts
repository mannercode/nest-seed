import { IsOptional } from 'class-validator'
import { PaginationOptionDto } from 'common'

export class CustomerQueryDto extends PaginationOptionDto {
    @IsOptional()
    name?: string

    @IsOptional()
    email?: string
}
