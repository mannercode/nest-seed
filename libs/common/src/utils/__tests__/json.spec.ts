import { InternalServerErrorException } from '@nestjs/common'
import { z } from 'zod'
import { JsonUtil, InstantFromInputSchema, PlainDateFromInputSchema } from '../index.js'

describe('JsonUtil', () => {
    describe('stringify', () => {
        it('Instant를 Date.toISOString과 같은 밀리초 3자리 JSON 계약으로 직렬화한다', () => {
            const at = Temporal.Instant.from('2023-06-18T12:12:34Z')

            expect(JsonUtil.stringify({ at })).toBe('{"at":"2023-06-18T12:12:34.000Z"}')
        })

        it('PlainDate는 YYYY-MM-DD 계약을 그대로 유지한다', () => {
            const date = Temporal.PlainDate.from('2023-06-18')

            expect(JsonUtil.stringify({ date })).toBe('{"date":"2023-06-18"}')
        })

        it('명시한 날짜 필드만 DTO 스키마로 복원하고 일반 문자열은 유지한다', () => {
            const input = {
                at: Temporal.Instant.from('2023-06-18T12:12:34.123456789Z'),
                date: Temporal.PlainDate.from('2023-06-18'),
                title: '2023-06-18'
            }

            const schema = z.object({
                at: InstantFromInputSchema,
                date: PlainDateFromInputSchema,
                title: z.string()
            })
            const output = schema.parse(JSON.parse(JsonUtil.stringify(input)))

            expect(output.at.toString()).toBe('2023-06-18T12:12:34.123Z')
            expect(output.date.equals(input.date)).toBe(true)
            expect(output.title).toBe(input.title)
        })

        it('JSON 문자열로 표현할 수 없는 root 값은 명시적으로 거부한다', () => {
            expect(() => JsonUtil.stringify(undefined)).toThrow(InternalServerErrorException)
        })
    })
})
