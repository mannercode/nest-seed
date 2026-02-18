import { IsOptional, IsString } from 'class-validator'
import { PaginationDto } from 'common'

export class SearchCustomersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    email?: string

    @IsOptional()
    @IsString()
    name?: string
}
