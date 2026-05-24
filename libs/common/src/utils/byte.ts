export class ByteUtil {
    /**
     * `10MB`, `2GB`, `-500KB` 같은 크기 표현식을 바이트 수로 변환한다.
     * 여러 단위는 공백으로 구분할 수 있고, 형식이 맞지 않으면 예외를 던진다.
     */
    static fromString(sizeExpression: string): number {
        const sizeUnitMap: { [key: string]: number } = {
            B: 1,
            GB: 1024 * 1024 * 1024,
            KB: 1024,
            MB: 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        }

        const validFormatRegex =
            /^(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)(\s+(-?\d+(\.\d+)?)(B|KB|MB|GB|TB))*$/i

        if (!validFormatRegex.test(sizeExpression)) {
            throw new Error(`Invalid size format(${sizeExpression})`)
        }

        const sizeTokenRegex = /(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)/gi
        let totalBytes = 0

        let sizeTokenMatch
        while ((sizeTokenMatch = sizeTokenRegex.exec(sizeExpression)) !== null) {
            const amount = parseFloat(sizeTokenMatch[1])
            const sizeUnit = sizeTokenMatch[3].toUpperCase()

            totalBytes += amount * sizeUnitMap[sizeUnit]
        }

        return totalBytes
    }

    /**
     * 바이트 수를 `1MB512KB`처럼 큰 단위부터 이어 붙인 문자열로 변환한다.
     * 0은 `0B`, 음수는 전체 결과 앞에 `-`를 붙여 표현한다.
     */
    static toString(bytes: number): string {
        if (bytes === 0) {
            return '0B'
        }

        const negative = bytes < 0
        bytes = Math.abs(bytes)

        const units = ['TB', 'GB', 'MB', 'KB', 'B']
        const sizes = [1024 * 1024 * 1024 * 1024, 1024 * 1024 * 1024, 1024 * 1024, 1024, 1]

        let result = ''

        for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
            const unitValue = sizes[unitIndex]
            if (bytes >= unitValue) {
                const unitAmount = Math.floor(bytes / unitValue)
                bytes %= unitValue
                result += `${unitAmount}${units[unitIndex]}`
            }
        }

        return (negative ? '-' : '') + result.trim()
    }
}
