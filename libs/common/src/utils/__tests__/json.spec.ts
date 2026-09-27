import { InternalServerErrorException } from '@nestjs/common'
import { z } from 'zod'
import { JsonUtil, InstantFromInputSchema, PlainDateFromInputSchema } from '../index.js'

describe('JsonUtil', () => {
    describe('stringify', () => {
        describe.each(['buddhist', 'japanese', 'hebrew'])(
            '날짜가 %s 달력으로 표현되어 있으면',
            (calendar) => {
                let date: Temporal.PlainDate
                beforeEach(() => {
                    date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
                })
                it('JSON으로 직렬화하면 ISO 날짜를 쓰고 같은 DTO 스키마로 복원할 수 있다', () => {
                    const schema = z.object({ date: PlainDateFromInputSchema })

                    const serialized = JsonUtil.stringify({ date })
                    const restored = schema.parse(JSON.parse(serialized))

                    expect(serialized).toBe('{"date":"2025-01-01"}')
                    expect(restored.date.calendarId).toBe('iso8601')
                    expect(restored.date.toString()).toBe('2025-01-01')
                    expect(date.calendarId).toBe(calendar)
                })
            }
        )

        describe('객체에 Instant가 있으면', () => {
            let at: Temporal.Instant
            beforeEach(() => {
                at = Temporal.Instant.from('2023-06-18T12:12:34Z')
            })
            it('JSON으로 직렬화하면 밀리초 세 자리의 UTC 문자열로 표현한다', () => {
                expect(JsonUtil.stringify({ at })).toBe('{"at":"2023-06-18T12:12:34.000Z"}')
            })
        })

        describe('객체에 ISO 달력의 PlainDate가 있으면', () => {
            let date: Temporal.PlainDate
            beforeEach(() => {
                date = Temporal.PlainDate.from('2023-06-18')
            })
            it('JSON으로 직렬화하면 YYYY-MM-DD 문자열로 표현한다', () => {
                expect(JsonUtil.stringify({ date })).toBe('{"date":"2023-06-18"}')
            })
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

        describe('최상위 값이 undefined이면', () => {
            let value: undefined
            beforeEach(() => {
                value = undefined
            })
            it('JSON으로 직렬화하면 예외를 던진다', () => {
                expect(() => JsonUtil.stringify(value)).toThrow(InternalServerErrorException)
            })
        })
    })
})
