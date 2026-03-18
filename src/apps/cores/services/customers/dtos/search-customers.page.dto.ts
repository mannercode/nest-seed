import { PaginationDto } from '@mannercode/nestlib-common'
import { IsOptional, IsString } from 'class-validator'

export class SearchCustomersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    email?: string

    @IsOptional()
    @IsString()
    name?: string
}
