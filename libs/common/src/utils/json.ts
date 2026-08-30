import { DateUtil } from './date.js'

const ISO_YEAR = '(?:[+-]\\d{6}|\\d{4})'
const ISO_INSTANT = new RegExp(`^${ISO_YEAR}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{1,9})?Z$`)
const ISO_PLAIN_DATE = new RegExp(`^${ISO_YEAR}-\\d{2}-\\d{2}$`)

function reviveTemporalValue(value: unknown): unknown {
    if (typeof value !== 'string') return value
    try {
        if (ISO_INSTANT.test(value)) return DateUtil.fromISOString(value)
        if (ISO_PLAIN_DATE.test(value)) return Temporal.PlainDate.from(value)
    } catch {
        // JSON 문법과 DTO 날짜 유효성은 별개다. 잘못된 날짜 문자열은 입력 스키마가 판단한다.
    }
    return value
}

export class JsonUtil {
    /**
     * JSON 문자열을 파싱한다. JavaScript 안전 정수 범위를 벗어난 부호 있는 64비트 정수는
     * 문자열로 보존하고, 엄격한 UTC instant와 날짜 전용 문자열은 Temporal 값으로 변환한다.
     */
    static parse(text: string): any {
        return JSON.parse(JsonUtil.quoteIntegers(text), JsonUtil.temporalReviver)
    }

    /** Instant를 기존 Date JSON 계약과 같은 밀리초 3자리 UTC 문자열로 고정한다. */
    static stringify(value: unknown): string {
        const serialized: unknown = JSON.stringify(value, JsonUtil.temporalReplacer)
        if (typeof serialized !== 'string') {
            throw new TypeError('Value cannot be represented as JSON.')
        }
        return serialized
    }

    /** Express의 `json replacer`에도 그대로 등록할 수 있다. */
    static temporalReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
        const original = this[key]
        return original instanceof Temporal.Instant ? DateUtil.toISOString(original) : value
    }

    private static temporalReviver(_key: string, value: unknown): unknown {
        return reviveTemporalValue(value)
    }

    /**
     * JSON 문자열 안에서 JavaScript 안전 정수 범위를 벗어난 부호 있는 64비트 정수 리터럴만
     * 문자열로 감싸 정밀도를 유지한다.
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
