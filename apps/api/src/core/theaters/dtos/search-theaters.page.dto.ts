import { PaginationDto } from '@mannercode/common'
import { IsOptional, IsString } from 'class-validator'

export class SearchTheatersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    name?: string
}
