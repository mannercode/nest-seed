import { PaginationDto } from '@mannercode/nestlib-common'
import { IsOptional, IsString } from 'class-validator'

export class SearchTheatersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    name?: string
}
