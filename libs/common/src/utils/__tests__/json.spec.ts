import { InternalServerErrorException } from '@nestjs/common'
import { z } from 'zod'
import { JsonUtil, InstantFromInputSchema, PlainDateFromInputSchema } from '../index.js'

describe('JsonUtil', () => {
    describe('stringify', () => {
        it.each(['buddhist', 'japanese', 'hebrew'])(
            '%s 달력의 날짜를 ISO JSON으로 보내고 같은 DTO 스키마로 복원한다',
            (calendar) => {
                const date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
                const schema = z.object({ date: PlainDateFromInputSchema })

                const serialized = JsonUtil.stringify({ date })
                const restored = schema.parse(JSON.parse(serialized))

                expect(serialized).toBe('{"date":"2025-01-01"}')
                expect(restored.date.calendarId).toBe('iso8601')
                expect(restored.date.toString()).toBe('2025-01-01')
                expect(date.calendarId).toBe(calendar)
            }
        )

        it('Instant를 밀리초 세 자리가 있는 UTC 문자열로 직렬화한다', () => {
            const at = Temporal.Instant.from('2023-06-18T12:12:34Z')

            expect(JsonUtil.stringify({ at })).toBe('{"at":"2023-06-18T12:12:34.000Z"}')
        })

        it('PlainDate를 YYYY-MM-DD 문자열로 직렬화한다', () => {
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

        it('최상위 값으로 undefined를 전달하면 예외를 던진다', () => {
            expect(() => JsonUtil.stringify(undefined)).toThrow(InternalServerErrorException)
        })
    })
})
