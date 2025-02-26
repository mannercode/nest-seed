import { Exception } from 'common'

export class DateUtil {
    /**
     * 시간 형식 문자열을 밀리초로 변환합니다.
     *
     * 입력 문자열은 숫자와 단위(ms, s, m, h, d)를 조합한 형식이어야 하며,
     * 여러 단위를 공백없이 또는 공백으로 구분하여 사용할 수 있습니다.
     *
     * @param {string} str - 변환할 시간 형식 문자열 (예: "1d 2h", "30m", "500ms").
     * @returns {number} 해당 시간의 밀리초 값.
     * @throws {Exception} 문자열 형식이 유효하지 않은 경우 예외를 발생시킵니다.
     */
    static toMs(str: string): number {
        const timeUnits: { [key: string]: number } = {
            ms: 1,
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        }

        // 유효한 시간 형식에 대한 정규 표현식
        const validFormatRegex = /^(-?\d+(\.\d+)?)(ms|s|m|h|d)(\s*(-?\d+(\.\d+)?)(ms|s|m|h|d))*$/

        if (!validFormatRegex.test(str)) {
            throw new Exception(`Invalid time format(${str})`)
        }

        const regex = /(-?\d+(\.\d+)?)(ms|s|m|h|d)/g
        let totalMillis = 0

        let match
        while ((match = regex.exec(str)) !== null) {
            const amount = parseFloat(match[1])
            const unit = match[3]

            totalMillis += amount * timeUnits[unit]
        }

        return totalMillis
    }

    /**
     * 밀리초 값을 시간 형식 문자열로 변환합니다.
     *
     * 반환되는 문자열은 d(일), h(시간), m(분), s(초), ms(밀리초) 단위로 구성되며,
     * 음수의 경우 "-" 기호가 접두사로 붙습니다.
     *
     * @param {number} ms - 변환할 밀리초 값.
     * @returns {string} 해당 밀리초를 표현하는 시간 형식 문자열.
     */
    static fromMs(ms: number): string {
        if (ms === 0) {
            return '0ms'
        }

        const negative = ms < 0
        ms = Math.abs(ms)

        const days = Math.floor(ms / (24 * 60 * 60 * 1000))
        ms %= 24 * 60 * 60 * 1000
        const hours = Math.floor(ms / (60 * 60 * 1000))
        ms %= 60 * 60 * 1000
        const minutes = Math.floor(ms / (60 * 1000))
        ms %= 60 * 1000
        const seconds = Math.floor(ms / 1000)
        const milliseconds = ms % 1000

        let result = ''
        if (days > 0) result += `${days}d`
        if (hours > 0) result += `${hours}h`
        if (minutes > 0) result += `${minutes}m`
        if (seconds > 0) result += `${seconds}s`
        if (milliseconds > 0) result += `${milliseconds}ms`

        return (negative ? '-' : '') + result.trim()
    }

    /**
     * 기준 날짜에 지정된 일수를 더한 새 날짜를 반환합니다.
     *
     * @param {Date} date - 기준 날짜.
     * @param {number} days - 더할 일수.
     * @returns {Date} 일수가 추가된 새 Date 객체.
     */
    static addDays(date: Date, days: number): Date {
        return new Date(date.getTime() + days * 24 * 60 * 60 * 1000)
    }

    /**
     * 기준 날짜에 지정된 분을 더한 새 날짜를 반환합니다.
     *
     * @param {Date} date - 기준 날짜.
     * @param {number} minutes - 더할 분 수.
     * @returns {Date} 분이 추가된 새 Date 객체.
     */
    static addMinutes(date: Date, minutes: number): Date {
        return new Date(date.getTime() + minutes * 60 * 1000)
    }

    /**
     * 날짜 배열 중 가장 이른 날짜를 반환합니다.
     *
     * @param {Date[]} dates - Date 객체 배열.
     * @returns {Date} 배열 중 가장 빠른 날짜.
     */
    static earliest(dates: Date[]): Date {
        const minTimestamp = Math.min(...dates.map((date) => date.getTime()))
        return new Date(minTimestamp)
    }

    /**
     * 날짜 배열 중 가장 늦은 날짜를 반환합니다.
     *
     * @param {Date[]} dates - Date 객체 배열.
     * @returns {Date} 배열 중 가장 늦은 날짜.
     */
    static latest(dates: Date[]): Date {
        const maxTimestamp = Math.max(...dates.map((date) => date.getTime()))
        return new Date(maxTimestamp)
    }

    /**
     * Date 객체를 YYYYMMDD 형식의 문자열로 변환합니다.
     *
     * @param {Date} date - 변환할 Date 객체.
     * @returns {string} "YYYYMMDD" 형식의 문자열.
     */
    static toYMD(date: Date): string {
        const year = date.getFullYear()
        const month = (date.getMonth() + 1).toString().padStart(2, '0') // 월은 2자리 숫자로 표현
        const day = date.getDate().toString().padStart(2, '0') // 일은 2자리 숫자로 표현
        return `${year}${month}${day}`
    }

    /**
     * YYYYMMDD 또는 YYYYMMDDHHmm 형식의 문자열을 Date 객체로 변환합니다.
     *
     * 문자열 길이가 8인 경우 (YYYYMMDD)는 시간은 00:00으로 설정됩니다.
     * 문자열 길이가 12인 경우 (YYYYMMDDHHmm)는 해당 시간까지 반영됩니다.
     *
     * @param {string} dateString - 변환할 날짜 문자열.
     * @returns {Date} 해당 문자열에 대응하는 Date 객체.
     * @throws {Error} 문자열 형식이 올바르지 않을 경우 예외를 발생시킵니다.
     */
    static fromYMD(dateString: string): Date {
        if (!(dateString.length === 8 || dateString.length === 12)) {
            throw new Exception('Invalid date string format. Expected YYYYMMDD or YYYYMMDDHHmm.')
        }

        const year = parseInt(dateString.substring(0, 4), 10)
        const month = parseInt(dateString.substring(4, 6), 10) - 1 // 월은 0부터 시작하므로 1을 빼줌
        const day = parseInt(dateString.substring(6, 8), 10)
        let hours = 0
        let minutes = 0

        if (dateString.length === 12) {
            hours = parseInt(dateString.substring(8, 10), 10)
            minutes = parseInt(dateString.substring(10, 12), 10)
        }

        return new Date(year, month, day, hours, minutes)
    }
}
