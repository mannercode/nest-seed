import { InternalServerErrorException } from '@nestjs/common'
import { DateUtil } from './date.js'

export class JsonUtil {
    /** Instant는 밀리초 3자리 UTC, PlainDate는 같은 날짜의 ISO 문자열로 내보낸다. */
    static stringify(value: unknown): string {
        const serialized: unknown = JSON.stringify(value, JsonUtil.temporalReplacer)
        if (typeof serialized !== 'string') {
            throw new InternalServerErrorException('Internal server error', {
                cause: 'Value cannot be represented as JSON.'
            })
        }
        return serialized
    }

    /** Express의 `json replacer`에도 그대로 등록할 수 있다. */
    static temporalReplacer(this: Record<string, unknown>, key: string, value: unknown): unknown {
        const original = this[key]
        if (original instanceof Temporal.Instant) return DateUtil.toISOString(original)
        if (original instanceof Temporal.PlainDate) {
            return DateUtil.plainDateFromInput(original).toString()
        }
        return value
    }
}
