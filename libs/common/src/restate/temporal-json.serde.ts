import type { Serde } from '@restatedev/restate-sdk'
import { JsonUtil } from '../utils/index.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** Temporal을 기존 JSON 형식으로 기록한다. 읽은 값의 복원은 호출 경계의 DTO 스키마가 맡는다. */
export const TemporalJsonSerde: Serde<unknown> = {
    contentType: 'application/json',
    deserialize: (data) => (data.length === 0 ? undefined : JSON.parse(decoder.decode(data))),
    serialize: (value) =>
        value === undefined ? new Uint8Array() : encoder.encode(JsonUtil.stringify(value))
}
