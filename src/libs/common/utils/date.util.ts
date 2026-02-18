import { maxBy, minBy } from 'lodash'

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
     * Returns the earliest date from an array of Date objects.
     * 날짜 배열 중 가장 이른 날짜를 반환합니다.
     *
     * @param {Date[]} dates - An array of Date objects.
     * @returns {Date} The earliest date in the array.
     */
    static earliest(dates: Date[]): Date {
        const minDate = minBy(dates, (date) => date.getTime())
        return minDate ? new Date(minDate.getTime()) : new Date(NaN)
    }

    /**
     * Converts a YYYYMMDD or YYYYMMDDHHmm format string into a Date object.
     * If the string length is 8 (YYYYMMDD), the time is set to 00:00.
     * If the string length is 12 (YYYYMMDDHHmm), the time is included.
     *
     * YYYYMMDD 또는 YYYYMMDDHHmm 형식의 문자열을 Date 객체로 변환합니다.
     * 문자열 길이가 8인 경우 (YYYYMMDD)는 시간은 00:00으로 설정됩니다.
     * 문자열 길이가 12인 경우 (YYYYMMDDHHmm)는 해당 시간까지 반영됩니다.
     *
     * @param {string} dateString - The date string to convert.
     * @returns {Date} A Date object corresponding to the string.
     * @throws {Error} Throws an error if the string format is invalid.
     */
    static fromYMD(dateString: string): Date {
        if (!(dateString.length === 8 || dateString.length === 12)) {
            throw new Error('Invalid date string format. Expected YYYYMMDD or YYYYMMDDHHmm.')
        }

        const year = parseInt(dateString.substring(0, 4), 10)
        const month = parseInt(dateString.substring(4, 6), 10) - 1 // Month is 0-based.
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
     * Returns the latest date from an array of Date objects.
     * 날짜 배열 중 가장 늦은 날짜를 반환합니다.
     *
     * @param {Date[]} dates - An array of Date objects.
     * @returns {Date} The latest date in the array.
     */
    static latest(dates: Date[]): Date {
        const maxDate = maxBy(dates, (date) => date.getTime())
        return maxDate ? new Date(maxDate.getTime()) : new Date(NaN)
    }

    static now(): Date {
        return new Date()
    }

    /**
     * Converts a Date object to a YYYYMMDD format string.
     * Date 객체를 YYYYMMDD 형식의 문자열로 변환합니다.
     *
     * @param {Date} date - The Date object to convert.
     * @returns {string} A string in the format "YYYYMMDD".
     */
    static toYMD(date: Date): string {
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0') // Month is 0-based.
        const day = date.getDate().toString().padStart(2, '0')
        return `${year}${month}${day}`
    }
}
