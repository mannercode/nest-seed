import { IsOptional, IsString } from 'class-validator'
import { PaginationDto } from 'common'

export class SearchWatchRecordsPageDto extends PaginationDto {
    @IsOptional()
    @IsString()
    customerId?: string
}
