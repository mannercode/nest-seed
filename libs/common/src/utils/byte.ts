export class ByteUtil {
    /**
     * 문자열 형식의 크기 정보를 바이트 단위의 숫자로 변환합니다.
     * 입력 문자열은 부호, 숫자, 단위(B, KB, MB, GB, TB)를 포함해야 하며,
     * 여러 크기 단위를 공백으로 구분하여 표현할 수 있습니다.
     *
     * @param {string} sizeExpression 변환할 size 형식 문자열 (예: "10MB", "2GB", "-500KB").
     * @returns {number} 문자열에 해당하는 총 byte 값.
     * @throws {Exception} 문자열 형식이 invalid 하면 exception 을 throw 한다.
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
     * 바이트 값을 문자열 형식으로 변환합니다.
     * 반환되는 문자열은 TB, GB, MB, KB, B 단위를 차례대로 포함하며,
     * 음수인 경우 "-" 기호가 접두사로 붙습니다.
     *
     * @param {number} bytes 변환할 byte 값.
     * @returns {string} 주어진 byte 값을 문자열로 표현한 결과.
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
