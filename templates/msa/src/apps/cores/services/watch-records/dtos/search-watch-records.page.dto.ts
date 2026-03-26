import { PaginationDto } from '@mannercode/common'
import { IsOptional, IsString } from 'class-validator'

export class SearchWatchRecordsPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    customerId?: string
}
