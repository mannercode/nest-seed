import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common'

const SHOWDATE_PATTERN = /^(\d{4})(\d{2})(\d{2})$/

// URL의 YYYYMMDD를 UTC 자정 Date로 바꾼다.
// UTC로 맞추는 이유는 `BookingService`의 검색 범위와 Mongo `$dateToString`의 결과가 모두 UTC 기준이라서다.
// 호스트 시간대를 섞으면 호스트가 UTC가 아닐 때 결과가 어긋난다.
@Injectable()
export class ParseShowdatePipe implements PipeTransform<string, Date> {
    transform(value: string): Date {
        const match = SHOWDATE_PATTERN.exec(value)
        if (!match) {
            throw new BadRequestException({
                code: 'ERR_BOOKING_SHOWDATE_INVALID',
                message: 'showdate must be in YYYYMMDD format',
                showdate: value
            })
        }
        const [, yearStr, monthStr, dayStr] = match
        const year = Number(yearStr)
        const month = Number(monthStr)
        const day = Number(dayStr)
        const date = new Date(Date.UTC(year, month - 1, day))
        // `Date.UTC`는 13월이나 2월 30일 같은 값을 조용히 보정해 다른 달로 넘긴다.
        // 한 번 만든 Date를 다시 분해해 원본과 같은지 확인하면 달력에 없는 날짜를 걸러낼 수 있다.
        if (
            date.getUTCFullYear() !== year ||
            date.getUTCMonth() !== month - 1 ||
            date.getUTCDate() !== day
        ) {
            throw new BadRequestException({
                code: 'ERR_BOOKING_SHOWDATE_INVALID',
                message: 'showdate must be a valid calendar date',
                showdate: value
            })
        }
        return date
    }
}
