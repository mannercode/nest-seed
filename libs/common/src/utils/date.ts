import { maxBy, minBy } from './lodash'

export type DateAddOptions = {
    base?: Date
    days?: number
    hours?: number
    minutes?: number
    seconds?: number
}

export class DateUtil {
    static add({
        base = this.now(),
        days = 0,
        hours = 0,
        minutes = 0,
        seconds = 0
    }: DateAddOptions): Date {
        const totalMilliseconds =
            days * 24 * 60 * 60 * 1000 +
            hours * 60 * 60 * 1000 +
            minutes * 60 * 1000 +
            seconds * 1000
        return new Date(base.getTime() + totalMilliseconds)
    }

    /**
     * 배열에서 가장 이른 날짜의 복사본을 반환한다. 빈 배열이면 `Invalid Date`를
     * 반환해 호출자가 별도로 값 없음 여부를 판단할 수 있게 한다.
     */
    static earliest(dates: Date[]): Date {
        const minDate = minBy(dates, (date) => date.getTime())
        return minDate ? new Date(minDate.getTime()) : new Date(NaN)
    }

    /**
     * `YYYYMMDD` 또는 `YYYYMMDDHHmm` 형식의 문자열을 로컬 시간대 Date로 변환한다.
     * 시간이 없으면 00:00으로 채운다. 형식 길이가 다르면 예외를 던지지만,
     * 달력에 없는 날짜 보정 여부는 JavaScript Date 동작을 그대로 따른다.
     */
    static fromYMD(dateString: string): Date {
        if (!(dateString.length === 8 || dateString.length === 12)) {
            throw new Error('Invalid date string format. Expected YYYYMMDD or YYYYMMDDHHmm.')
        }

        const year = parseInt(dateString.substring(0, 4), 10)
        const month = parseInt(dateString.substring(4, 6), 10) - 1 // JS Date의 월은 0부터 시작한다.
        const day = parseInt(dateString.substring(6, 8), 10)
        let hours = 0
        let minutes = 0

        if (dateString.length === 12) {
            hours = parseInt(dateString.substring(8, 10), 10)
            minutes = parseInt(dateString.substring(10, 12), 10)
        }

        return new Date(year, month, day, hours, minutes)
    }

    /**
     * 배열에서 가장 늦은 날짜의 복사본을 반환한다. 빈 배열이면 `Invalid Date`를
     * 반환한다.
     */
    static latest(dates: Date[]): Date {
        const maxDate = maxBy(dates, (date) => date.getTime())
        return maxDate ? new Date(maxDate.getTime()) : new Date(NaN)
    }

    static now(): Date {
        return new Date()
    }

    /**
     * Date 객체의 로컬 날짜 부분을 `YYYYMMDD` 문자열로 변환한다.
     */
    static toYMD(date: Date): string {
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0') // JS Date의 월은 0부터 시작한다.
        const day = date.getDate().toString().padStart(2, '0')
        return `${year}${month}${day}`
    }
}
