import { PaginationDto } from '@mannercode/nest-common'
import { IsOptional, IsString } from 'class-validator'

export class SearchCustomersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    email?: string

    @IsOptional()
    @IsString()
    name?: string
}
