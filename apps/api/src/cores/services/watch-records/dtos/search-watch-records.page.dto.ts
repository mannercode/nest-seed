import { PaginationDto } from '@mannercode/common'
import { IsOptional, IsString } from 'class-validator'

export class SearchWatchRecordsPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    userId?: string
}
