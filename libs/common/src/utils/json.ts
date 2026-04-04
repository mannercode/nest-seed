function isDateString(value: unknown): value is string {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    return typeof value === 'string' && ISO_DATE.test(value)
}

export class JsonUtil {
    /**
     * Parses a JSON string, converting 64-bit integers to quoted strings and date strings to Date objects.
     * JSON 문자열을 파싱하며 64비트 정수를 문자열로, 날짜 문자열을 Date 객체로 변환
     */
    static parse(text: string): any {
        return JSON.parse(JsonUtil.quoteIntegers(text), JsonUtil.dateReviver)
    }

    /**
     * Recursively traverses a JSON-like object or value and converts date strings to Date objects.
     * JSON 형태의 객체를 재귀적으로 순회하며 날짜 문자열을 Date 객체로 변환
     *
     * @param {any} input - The object or value to convert.
     * @returns {any} The converted object (date strings become Date objects).
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
     * Wraps 64-bit integers in a JSON string with quotes to preserve precision.
     * JSON 문자열 내 64비트 정수를 문자열로 감싸 정밀도를 유지
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
