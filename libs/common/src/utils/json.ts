function isDateString(value: unknown): value is string {
    const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
    return typeof value === 'string' && ISO_DATE.test(value)
}

export class JsonUtil {
    /**
     * JSON 문자열을 파싱하며 64비트 정수를 문자열로, 날짜 문자열을 Date 객체로 변환한다.
     */
    static parse(text: string): any {
        return JSON.parse(JsonUtil.quoteIntegers(text), JsonUtil.dateReviver)
    }

    /**
     * JSON 형태의 객체를 재귀적으로 순회하며 날짜 문자열을 Date 객체로 변환한다.
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
     * JSON 문자열 안의 64비트 정수를 문자열로 감싸 정밀도를 유지한다.
     * 정규식 한 방이면 문자열 리터럴 내부의 숫자까지 건드리므로,
     * 따옴표 구간(이스케이프 포함)을 통째로 건너뛰며 구조 토큰만 검사한다.
     */
    private static quoteIntegers(text: string): string {
        let out = ''
        let i = 0

        while (i < text.length) {
            const ch = text.charAt(i)

            if (ch === '"') {
                const end = this.findStringEnd(text, i)
                out += text.slice(i, end)
                i = end
                continue
            }

            if (ch === '-' || (ch >= '0' && ch <= '9')) {
                const end = this.findNumberEnd(text, i)
                const raw = text.slice(i, end)
                out += this.shouldQuote(raw) ? `"${raw}"` : raw
                i = end
                continue
            }

            out += ch
            i++
        }

        return out
    }

    private static findStringEnd(text: string, start: number): number {
        let i = start + 1
        while (i < text.length) {
            if (text[i] === '\\') {
                i += 2
                continue
            }
            if (text[i] === '"') return i + 1
            i++
        }
        return text.length
    }

    private static findNumberEnd(text: string, start: number): number {
        let i = start
        if (text.charAt(i) === '-') i++
        while (i < text.length && /[\d.eE+-]/.test(text.charAt(i))) i++
        return i
    }

    private static shouldQuote(raw: string): boolean {
        // 소수·지수 표기는 정밀도 보존 대상이 아니다.
        if (!/^-?\d+$/.test(raw)) return false

        const maxInt64 = 9223372036854775807n
        const minInt64 = -9223372036854775808n
        const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)

        const value = BigInt(raw)
        if (value < minInt64 || value > maxInt64) return false

        return value > maxSafe || value < -maxSafe
    }
}
