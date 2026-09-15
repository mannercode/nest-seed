import { DateUtil } from './date.js'

export class JsonUtil {
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
}
