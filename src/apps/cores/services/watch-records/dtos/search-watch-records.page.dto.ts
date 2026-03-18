import { PaginationDto } from '@mannercode/nestlib-common'
import { IsOptional, IsString } from 'class-validator'

export class SearchWatchRecordsPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    customerId?: string
}
