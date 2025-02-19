import { IsOptional } from 'class-validator'
import { PaginationOptionDto } from 'common'

export class WatchRecordQueryDto extends PaginationOptionDto {
    @IsOptional()
    customerId?: string
}
