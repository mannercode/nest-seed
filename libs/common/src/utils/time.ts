import { ensure } from './validator'

export class TimeUtil {
    /**
     * `1d 2h`, `30m`, `500ms` 같은 시간 표현식을 밀리초로 변환한다.
     * 단위는 `ms`, `s`, `m`, `h`, `d`만 허용하며, 형식이 맞지 않으면 예외를 던진다.
     */
    static toMs(timeExpression: string): number {
        const validFormatRegex = /^(-?\d+(\.\d+)?)(ms|s|m|h|d)(\s*(-?\d+(\.\d+)?)(ms|s|m|h|d))*$/

        if (!validFormatRegex.test(timeExpression)) {
            throw new Error(`Invalid time format(${timeExpression})`)
        }

        const timeTokenRegex = /(-?\d+(?:\.\d+)?)(ms|s|m|h|d)/g
        let totalMilliseconds = 0

        for (const [, amount, unit] of timeExpression.matchAll(timeTokenRegex)) {
            let unitValue: number
            switch (ensure(unit)) {
                case 'd':
                    unitValue = 24 * 60 * 60 * 1000
                    break
                case 'h':
                    unitValue = 60 * 60 * 1000
                    break
                case 'm':
                    unitValue = 60 * 1000
                    break
                case 's':
                    unitValue = 1000
                    break
                default:
                    unitValue = 1
            }
            totalMilliseconds += Number(amount) * unitValue
        }

        return totalMilliseconds
    }
}
