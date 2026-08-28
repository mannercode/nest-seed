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
     * 배열에서 가장 이른 날짜의 복사본을 반환한다.
     * 빈 배열이면 `Invalid Date`를 반환해 호출자가 별도로 값 없음 여부를 판단할 수 있게 한다.
     */
    static earliest(dates: Date[]): Date {
        const minDate = minBy(dates, (date) => date.getTime())
        return minDate ? new Date(minDate.getTime()) : new Date(NaN)
    }

    /**
     * 배열에서 가장 늦은 날짜의 복사본을 반환한다.
     * 빈 배열이면 `Invalid Date`를 반환한다.
     */
    static latest(dates: Date[]): Date {
        const maxDate = maxBy(dates, (date) => date.getTime())
        return maxDate ? new Date(maxDate.getTime()) : new Date(NaN)
    }

    static now(): Date {
        return new Date()
    }
}
