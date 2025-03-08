
export class Byte {
    /**
     * 문자열 형식의 크기 정보를 바이트 단위의 숫자로 변환합니다.
     *
     * 입력 문자열은 부호, 숫자, 단위(B, KB, MB, GB, TB)를 포함해야 하며,
     * 여러 크기 단위를 공백으로 구분하여 표현할 수 있습니다.
     *
     * @param {string} str - 변환할 크기 형식 문자열 (예: "10MB", "2GB", "-500KB").
     * @returns {number} 해당 문자열에 해당하는 총 바이트 값.
     * @throws {Exception} 문자열 형식이 올바르지 않을 경우 예외를 발생시킵니다.
     */
    static fromString(str: string): number {
        const sizeUnits: { [key: string]: number } = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        }

        const validFormatRegex =
            /^(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)(\s+(-?\d+(\.\d+)?)(B|KB|MB|GB|TB))*$/i

        if (!validFormatRegex.test(str)) {
            throw new Error(`Invalid size format(${str})`)
        }

        const regex = /(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)/gi
        let totalBytes = 0

        let match
        while ((match = regex.exec(str)) !== null) {
            const amount = parseFloat(match[1])
            const unit = match[3].toUpperCase()

            totalBytes += amount * sizeUnits[unit]
        }

        return totalBytes
    }

    /**
     * 바이트 값을 문자열 형식으로 변환합니다.
     *
     * 반환되는 문자열은 TB, GB, MB, KB, B 단위를 차례대로 포함하며,
     * 음수인 경우 "-" 기호가 접두사로 붙습니다.
     *
     * @param {number} bytes - 변환할 바이트 값.
     * @returns {string} 해당 바이트 값을 표현하는 문자열.
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

        for (let i = 0; i < units.length; i++) {
            const unitValue = sizes[i]
            if (bytes >= unitValue) {
                const unitAmount = Math.floor(bytes / unitValue)
                bytes %= unitValue
                result += `${unitAmount}${units[i]}`
            }
        }

        return (negative ? '-' : '') + result.trim()
    }
}
