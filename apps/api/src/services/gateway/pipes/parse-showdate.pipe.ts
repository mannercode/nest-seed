import { DateUtil } from '@mannercode/common'
import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'

const SHOWDATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/

// URL의 YYYYMMDD는 시각이나 시간대가 없는 달력 날짜로 해석한다.
@Injectable()
export class ParseShowdatePipe implements PipeTransform<string, Temporal.PlainDate> {
    transform(value: string): Temporal.PlainDate {
        if (!SHOWDATE_PATTERN.test(value)) {
            throw new BadRequestException({
                code: 'ERR_BOOKING_SHOWDATE_INVALID',
                message: 'showdate must be in YYYYMMDD format',
                showdate: value
            })
        }
        try {
            return DateUtil.fromYMD(value)
        } catch {
            throw new BadRequestException({
                code: 'ERR_BOOKING_SHOWDATE_INVALID',
                message: 'showdate must be a valid calendar date',
                showdate: value
            })
        }
    }
}
