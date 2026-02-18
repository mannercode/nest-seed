import { Type } from 'class-transformer'
import { IsDate, IsOptional } from 'class-validator'
import { DateUtil } from '../utils'

type DateTimeRangeOptions = { start?: Date; end?: Date; minutes?: number; days?: number }

export class DateTimeRange {
    @IsDate()
    @Type(() => Date)
    start: Date

    @IsDate()
    @Type(() => Date)
    end: Date

    private static fromValues(start: Date, end: Date): DateTimeRange {
        const range = new DateTimeRange()
        range.start = start
        range.end = end
        return range
    }

    static create({ start, end, days, minutes }: DateTimeRangeOptions): DateTimeRange {
        if (start) {
            if (end) {
                return this.fromValues(start, end)
            }

            if (days !== undefined || minutes !== undefined) {
                const rangeEnd = DateUtil.add({ base: start, days, minutes })
                return this.fromValues(start, rangeEnd)
            }
        }

        throw new Error('Invalid options provided.')
    }
}

export class PartialDateTimeRange {
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    start?: Date

    @IsOptional()
    @IsDate()
    @Type(() => Date)
    end?: Date
}
