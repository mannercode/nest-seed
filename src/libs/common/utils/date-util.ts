export class DateUtil {
    /**
     * Returns the earliest date from an array of Date objects.
     * 날짜 배열 중 가장 이른 날짜를 반환합니다.
     *
     * @param {Date[]} dates - An array of Date objects.
     * @returns {Date} The earliest date in the array.
     */
    static earliest(dates: Date[]): Date {
        const minTimestamp = Math.min(...dates.map((date) => date.getTime()))
        return new Date(minTimestamp)
    }

    /**
     * Returns the latest date from an array of Date objects.
     * 날짜 배열 중 가장 늦은 날짜를 반환합니다.
     *
     * @param {Date[]} dates - An array of Date objects.
     * @returns {Date} The latest date in the array.
     */
    static latest(dates: Date[]): Date {
        const maxTimestamp = Math.max(...dates.map((date) => date.getTime()))
        return new Date(maxTimestamp)
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

    static now(): Date {
        return new Date()
    }

    /**
     * Returns a new date with a specified number of days added to the base date.
     * 기준 날짜에 지정된 일수를 더한 새 날짜를 반환합니다.
     *
     * @param {Date} date - The base date.
     * @param {number} days - The number of days to add.
     * @returns {Date} A new Date object with added days.
     */
    static addDays(date: Date, days: number): Date {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
    }

    /**
     * Returns a new date with a specified number of minutes added to the base date.
     * 기준 날짜에 지정된 분을 더한 새 날짜를 반환합니다.
     *
     * @param {Date} date - The base date.
     * @param {number} minutes - The number of minutes to add.
     * @returns {Date} A new Date object with added minutes.
     */
    static addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000)
    }

    // TODO 구현해라, addMinutes 같은거 삭제해라
    // 과거: past
    // 미래: future
}
