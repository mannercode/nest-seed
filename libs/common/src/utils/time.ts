export class TimeUtil {
    /**
     * 밀리초 값을 `1d2h3m4s5ms`처럼 큰 단위부터 이어 붙인 문자열로 변환한다.
     * 0은 `0ms`, 음수는 전체 결과 앞에 `-`를 붙여 표현한다.
     */
    static fromMs(milliseconds: number): string {
        if (milliseconds === 0) {
            return '0ms'
        }

        const isNegative = milliseconds < 0
        let remainingMs = Math.abs(milliseconds)

        const days = Math.floor(remainingMs / (24 * 60 * 60 * 1000))
        remainingMs %= 24 * 60 * 60 * 1000
        const hours = Math.floor(remainingMs / (60 * 60 * 1000))
        remainingMs %= 60 * 60 * 1000
        const minutes = Math.floor(remainingMs / (60 * 1000))
        remainingMs %= 60 * 1000
        const seconds = Math.floor(remainingMs / 1000)
        const millisecondsRemainder = remainingMs % 1000

        let result = ''
        if (days > 0) result += `${days}d`
        if (hours > 0) result += `${hours}h`
        if (minutes > 0) result += `${minutes}m`
        if (seconds > 0) result += `${seconds}s`
        if (millisecondsRemainder > 0) result += `${millisecondsRemainder}ms`

        return (isNegative ? '-' : '') + result.trim()
    }

    /**
     * `1d 2h`, `30m`, `500ms` 같은 시간 표현식을 밀리초로 변환한다. 단위는
     * `ms`, `s`, `m`, `h`, `d`만 허용하며, 형식이 맞지 않으면 예외를 던진다.
     */
    static toMs(timeExpression: string): number {
        const timeUnitMap: { [key: string]: number } = {
            d: 24 * 60 * 60 * 1000,
            h: 60 * 60 * 1000,
            m: 60 * 1000,
            ms: 1,
            s: 1000
        }

        const validFormatRegex = /^(-?\d+(\.\d+)?)(ms|s|m|h|d)(\s*(-?\d+(\.\d+)?)(ms|s|m|h|d))*$/

        if (!validFormatRegex.test(timeExpression)) {
            throw new Error(`Invalid time format(${timeExpression})`)
        }

        const timeTokenRegex = /(-?\d+(\.\d+)?)(ms|s|m|h|d)/g
        let totalMilliseconds = 0

        let tokenMatch
        while ((tokenMatch = timeTokenRegex.exec(timeExpression)) !== null) {
            const timeValue = parseFloat(tokenMatch[1])
            const timeUnit = tokenMatch[3]

            totalMilliseconds += timeValue * timeUnitMap[timeUnit]
        }

        return totalMilliseconds
    }
}
