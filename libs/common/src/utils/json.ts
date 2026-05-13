function isDateString(value: unknown): value is string {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    return typeof value === 'string' && ISO_DATE.test(value)
}

export class JsonUtil {
    /**
     * JSON 문자열을 파싱하며 64비트 정수를 문자열로, 날짜 문자열을 Date 객체로 변환합니다.
     */
    static parse(text: string): any {
        return JSON.parse(JsonUtil.quoteIntegers(text), JsonUtil.dateReviver)
    }

    /**
     * JSON 형태의 객체를 재귀적으로 순회하며 날짜 문자열을 Date 객체로 변환합니다.
     *
     * @param {any} input 변환할 객체 또는 값.
     * @returns {any} 변환된 객체. 날짜 문자열은 Date 객체가 됩니다.
     */
    static reviveDates(input: any): any {
        if (isDateString(input)) {
            return new Date(input)
        }

        if (input === null || typeof input !== 'object') {
            return input
        }

        if (input instanceof Date) {
            return input
        }

        if (Array.isArray(input)) {
            return input.map((item) => JsonUtil.reviveDates(item))
        }

        const convertedObject: Record<string, unknown> = {}
        const source = input as Record<string, unknown>

        for (const [key, nestedValue] of Object.entries(source)) {
            if (typeof nestedValue === 'object') {
                convertedObject[key] = JsonUtil.reviveDates(nestedValue)
            } else if (isDateString(nestedValue)) {
                convertedObject[key] = new Date(nestedValue)
            } else {
                convertedObject[key] = nestedValue
            }
        }

        return convertedObject
    }

    private static dateReviver(_key: string, value: unknown): unknown {
        if (isDateString(value)) {
            return new Date(value)
        }
        return value
    }

    /**
     * JSON 문자열 안의 64비트 정수를 문자열로 감싸 정밀도를 유지합니다.
     */
    private static quoteIntegers(text: string): string {
        const maxInt64 = 9223372036854775807n
        const minInt64 = -9223372036854775808n
        const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
        const minSafe = -maxSafe

        return text.replace(/([:\[,])(\s*)(-?\d+)(?=\s*[,\}\]])/g, (match, prefix, space, raw) => {
            const value = BigInt(raw)

            if (value < minInt64 || value > maxInt64) {
                return match
            }

            if (minSafe <= value && value <= maxSafe) {
                return match
            }

            return `${prefix}${space}"${raw}"`
        })
    }
}
