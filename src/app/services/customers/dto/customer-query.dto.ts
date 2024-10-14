import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class CustomerQueryDto extends PaginationOption {
    @IsOptional()
    name?: string

    @IsOptional()
    email?: string
}
