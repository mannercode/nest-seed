export class Json {
    /**
     * Wraps 64-bit integers in a JSON string with quotes to preserve precision.
     * Only values within the signed 64-bit range and outside JS safe integer range are quoted.
     *
     * JSON 문자열 내 64비트 정수를 큰 정밀도를 유지하기 위해 문자열로 감싸 반환합니다.
     * JS safe integer 범위를 벗어나는 값만 문자열로 처리합니다.
     *
     * @example
     * Json.quoteIntegers('{"id":9223372036854775807}') -> '{"id":"9223372036854775807"}'
     *
     * @param {string} text - The JSON string to process.
     * @returns {string} A JSON string where numeric values are quoted.
     */
    static quoteIntegers(text: string): string {
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

    /**
     * Recursively traverses a JSON-like object or value and converts ISO 8601 date strings to Date objects.
     * JSON 형태의 객체를 재귀적으로 순회하며 ISO 8601 형식의 날짜 문자열을 Date 객체로 변환
     *
     * @param {any} input - The object or value to convert.
     * @returns {any} The converted object (date strings become Date objects).
     */
    static reviveIsoDates(input: any): any {
        if (
            typeof input === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input)
        ) {
            return new Date(input)
        }

        if (input === null || typeof input !== 'object') {
            return input
        }

        if (input instanceof Date) {
            return input
        }

        if (Array.isArray(input)) {
            return input.map((item) => Json.reviveIsoDates(item))
        }

        const convertedObject: Record<string, unknown> = {}
        const source = input as Record<string, unknown>

        for (const [key, nestedValue] of Object.entries(source)) {
            if (
                typeof nestedValue === 'string' &&
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(nestedValue)
            ) {
                convertedObject[key] = new Date(nestedValue)
            } else if (typeof nestedValue === 'object') {
                convertedObject[key] = Json.reviveIsoDates(nestedValue)
            } else {
                convertedObject[key] = nestedValue
            }
        }

        return convertedObject
    }
}
