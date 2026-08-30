import type { Serde } from '@restatedev/restate-sdk'
import { JsonUtil } from '@mannercode/common'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Restate의 입력과 journal 값을 애플리케이션의 Temporal JSON 계약으로 왕복시킨다. */
export const TemporalJsonSerde: Serde<unknown> = {
    contentType: 'application/json',
    deserialize: (data) => (data.length === 0 ? undefined : JsonUtil.parse(decoder.decode(data))),
    serialize: (value) =>
        value === undefined ? new Uint8Array() : encoder.encode(JsonUtil.stringify(value))
}
