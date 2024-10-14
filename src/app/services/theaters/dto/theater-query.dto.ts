import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class TheaterQueryDto extends PaginationOption {
    @IsOptional()
    name?: string
}
