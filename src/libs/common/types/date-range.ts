import { Type } from 'class-transformer'
import { IsDate } from 'class-validator'

export class DateRange {
    @IsDate()
    @Type(() => Date)
    start?: Date

    @IsDate()
    @Type(() => Date)
    end?: Date
}
