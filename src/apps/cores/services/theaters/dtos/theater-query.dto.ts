import { IsOptional } from 'class-validator'
import { PaginationOptionDto } from 'common'

export class TheaterQueryDto extends PaginationOptionDto {
    @IsOptional()
    name?: string
}
