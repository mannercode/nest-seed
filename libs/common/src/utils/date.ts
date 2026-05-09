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
     * 날짜 배열 중 가장 이른 날짜를 반환합니다.
     *
     * @param {Date[]} dates Date object 배열.
     * @returns {Date} 배열에서 가장 이른 날짜.
     */
    static earliest(dates: Date[]): Date {
        const minDate = minBy(dates, (date) => date.getTime())
        return minDate ? new Date(minDate.getTime()) : new Date(NaN)
    }

    /**
     * YYYYMMDD 또는 YYYYMMDDHHmm 형식의 문자열을 Date 객체로 변환합니다.
     * 문자열 길이가 8인 경우 (YYYYMMDD)는 시간은 00:00으로 설정됩니다.
     * 문자열 길이가 12인 경우 (YYYYMMDDHHmm)는 해당 시간까지 반영됩니다.
     *
     * @param {string} dateString 변환할 날짜 문자열.
     * @returns {Date} 문자열에 해당하는 Date object.
     * @throws {Error} 문자열 형식이 invalid 하면 error 를 throw 한다.
     */
    static fromYMD(dateString: string): Date {
        if (!(dateString.length === 8 || dateString.length === 12)) {
            throw new Error('Invalid date string format. Expected YYYYMMDD or YYYYMMDDHHmm.')
        }

        const year = parseInt(dateString.substring(0, 4), 10)
        const month = parseInt(dateString.substring(4, 6), 10) - 1 // Month 는 0-based.
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
     * 날짜 배열 중 가장 늦은 날짜를 반환합니다.
     *
     * @param {Date[]} dates Date object 배열.
     * @returns {Date} 배열에서 가장 늦은 날짜.
     */
    static latest(dates: Date[]): Date {
        const maxDate = maxBy(dates, (date) => date.getTime())
        return maxDate ? new Date(maxDate.getTime()) : new Date(NaN)
    }

    static now(): Date {
        return new Date()
    }

    /**
     * Date 객체를 YYYYMMDD 형식의 문자열로 변환합니다.
     *
     * @param {Date} date 변환할 Date object.
     * @returns {string} "YYYYMMDD" 형식의 문자열.
     */
    static toYMD(date: Date): string {
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0') // Month 는 0-based.
        const day = date.getDate().toString().padStart(2, '0')
        return `${year}${month}${day}`
    }
}
