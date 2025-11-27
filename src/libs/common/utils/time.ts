import type { StringValue } from 'ms'

export class Time {
    /**
     * Converts a time format string into milliseconds.
     * The input string should be a combination of numbers and units (ms, s, m, h, d),
     * and can include multiple units separated by spaces or no space.
     *
     * 시간 형식 문자열을 밀리초로 변환합니다.
     * 입력 문자열은 숫자와 단위(ms, s, m, h, d)를 조합한 형식이어야 하며,
     * 여러 단위를 공백없이 또는 공백으로 구분하여 사용할 수 있습니다.
     *
     * @param {string} str - The time format string to convert (e.g., "1d 2h", "30m", "500ms").
     * @returns {number} The millisecond value of the given time string.
     * @throws {Exception} Throws an exception if the string format is invalid.
     */
    static toMs(str: string): number {
        const timeUnits: { [key: string]: number } = {
            ms: 1,
            s: 1000,
            m: 60 * 1000,
            h: 60 * 60 * 1000,
            d: 24 * 60 * 60 * 1000
        }

        // Valid time format regex
        const validFormatRegex = /^(-?\d+(\.\d+)?)(ms|s|m|h|d)(\s*(-?\d+(\.\d+)?)(ms|s|m|h|d))*$/

        if (!validFormatRegex.test(str)) {
            throw new Error(`Invalid time format(${str})`)
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
     * Converts a millisecond value into a time format string.
     * The returned string can include d (days), h (hours), m (minutes), s (seconds), ms (milliseconds) units,
     * and if negative, a '-' sign is prefixed.
     *
     * 밀리초 값을 시간 형식 문자열로 변환합니다.
     * 반환되는 문자열은 d(일), h(시간), m(분), s(초), ms(밀리초) 단위로 구성되며,
     * 음수의 경우 "-" 기호가 접두사로 붙습니다.
     *
     * @param {number} ms - The millisecond value to convert.
     * @returns {string} The time format string representing the given milliseconds.
     */
    static fromMs(ms: number): StringValue {
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

        return ((negative ? '-' : '') + result.trim()) as StringValue
    }
}
