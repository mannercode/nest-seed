import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class QueryTheatersDto extends PaginationOption {
    @IsOptional()
    name?: string
}
