import { IsOptional } from 'class-validator'
import { PaginationOption } from 'common'

export class WatchRecordQueryDto extends PaginationOption {
    @IsOptional()
    customerId?: string
}
