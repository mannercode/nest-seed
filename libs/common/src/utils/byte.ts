import { ensure } from './validator'

export class ByteUtil {
    /**
     * `10MB`, `2GB`, `-500KB` 같은 크기 표현식을 바이트 수로 변환한다.
     * 여러 단위는 공백으로 구분할 수 있고, 형식이 맞지 않으면 예외를 던진다.
     */
    static fromString(sizeExpression: string): number {
        const validFormatRegex =
            /^(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)(\s+(-?\d+(\.\d+)?)(B|KB|MB|GB|TB))*$/i

        if (!validFormatRegex.test(sizeExpression)) {
            throw new Error(`Invalid size format(${sizeExpression})`)
        }

        // 단위를 대문자로 통일해 두면 토큰을 그대로 비교할 수 있다.
        const normalized = sizeExpression.toUpperCase()
        const sizeTokenRegex = /(-?\d+(?:\.\d+)?)(B|KB|MB|GB|TB)/g

        let totalBytes = 0
        for (const [, amount, unit] of normalized.matchAll(sizeTokenRegex)) {
            let unitValue: number
            switch (ensure(unit)) {
                case 'TB':
                    unitValue = 1024 ** 4
                    break
                case 'GB':
                    unitValue = 1024 ** 3
                    break
                case 'MB':
                    unitValue = 1024 ** 2
                    break
                case 'KB':
                    unitValue = 1024
                    break
                default:
                    unitValue = 1
            }
            totalBytes += Number(amount) * unitValue
        }

        return totalBytes
    }

    /**
     * 바이트 수를 `1MB 512KB`처럼 큰 단위부터 공백으로 이어 붙인 문자열로 변환한다.
     * `fromString`이 그대로 읽어 같은 값이 되도록(왕복 변환) 음수는 각 토큰에 부호를 붙인다.
     */
    static toString(bytes: number): string {
        if (bytes === 0) {
            return '0B'
        }

        const sign = bytes < 0 ? '-' : ''
        bytes = Math.abs(bytes)

        const unitTable: [string, number][] = [
            ['TB', 1024 ** 4],
            ['GB', 1024 ** 3],
            ['MB', 1024 ** 2],
            ['KB', 1024],
            ['B', 1]
        ]

        const parts: string[] = []

        for (const [unit, unitValue] of unitTable) {
            if (bytes >= unitValue) {
                const unitAmount = Math.floor(bytes / unitValue)
                bytes %= unitValue
                parts.push(`${sign}${unitAmount}${unit}`)
            }
        }

        return parts.join(' ')
    }
}
