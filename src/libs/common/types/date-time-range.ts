import { Type } from 'class-transformer'
import { IsDate } from 'class-validator'
import { DateUtil } from '../utils'

type DateTimeRangeOptions = { start?: Date; end?: Date; minutes?: number; days?: number }

export class DateTimeRange {
    @IsDate()
    @Type(() => Date)
    start: Date

    @IsDate()
    @Type(() => Date)
    end: Date

    static create({ start, end, days, minutes }: DateTimeRangeOptions) {
        if (start) {
            if (end) {
                return { start, end }
            } else if (days || minutes) {
                return { start, end: DateUtil.add({ base: start, days, minutes }) }
            }
        }

        throw new Error('Invalid options provided.')
    }
}

export class PartialDateTimeRange {
    @IsDate()
    @Type(() => Date)
    start?: Date

    @IsDate()
    @Type(() => Date)
    end?: Date
}
