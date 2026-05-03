import { PaginationDto } from '@mannercode/common'
import { IsOptional, IsString } from 'class-validator'

export class SearchUsersPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    email?: string

    @IsOptional()
    @IsString()
    name?: string
}
