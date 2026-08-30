import { instant, plainDate } from '@mannercode/testing'
import { TemporalJsonSerde } from '../temporal-json.serde.js'

describe('TemporalJsonSerde', () => {
    it('Restate wire와 journal에서 Instant와 PlainDate를 원래 의미로 왕복한다', () => {
        const value = { date: plainDate('2025-01-02'), timestamp: instant('2025-01-02T03:04:00Z') }

        const serialized = TemporalJsonSerde.serialize(value)

        expect(new TextDecoder().decode(serialized)).toBe(
            '{"date":"2025-01-02","timestamp":"2025-01-02T03:04:00.000Z"}'
        )
        expect(TemporalJsonSerde.deserialize(serialized)).toEqual(value)
    })

    it('void handler와 ctx.run 결과는 빈 payload로 왕복한다', () => {
        const serialized = TemporalJsonSerde.serialize(undefined)

        expect(serialized).toHaveLength(0)
        expect(TemporalJsonSerde.deserialize(serialized)).toBeUndefined()
    })
})
