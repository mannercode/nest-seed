import { Type } from 'class-transformer'
import { IsDate, IsOptional } from 'class-validator'
import { DateUtil } from '../utils'

type DateTimeRangeOptions = { days?: number; end?: Date; minutes?: number; start?: Date }

export class DateTimeRange {
    @IsDate()
    @Type(() => Date)
    end: Date

    @IsDate()
    @Type(() => Date)
    start: Date

    static create({ days, end, minutes, start }: DateTimeRangeOptions): DateTimeRange {
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

    private static fromValues(start: Date, end: Date): DateTimeRange {
        const range = new DateTimeRange()
        range.start = start
        range.end = end
        return range
    }
}

export class PartialDateTimeRange {
    @IsDate()
    @IsOptional()
    @Type(() => Date)
    end?: Date

    @IsDate()
    @IsOptional()
    @Type(() => Date)
    start?: Date
}
