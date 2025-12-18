import { IsOptional, IsString } from 'class-validator'
import { PaginationDto } from 'common'

export class SearchTheatersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    name?: string
}
