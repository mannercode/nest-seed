import { nullDate } from '@mannercode/testing'
import { JsonUtil } from '../json'

describe('JsonUtil', () => {
    describe('parse', () => {
        // 날짜 문자열을 Date 객체로 변환한다
        it('converts date strings to Date objects', () => {
            const parsed = JsonUtil.parse('{"date":"2023-06-18T12:12:34.567Z"}')

            expect(parsed.date).toBeInstanceOf(Date)
            expect(parsed.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        // 64비트 정수를 문자열로 변환한다
        it('converts 64-bit integers to strings', () => {
            const parsed = JsonUtil.parse('[{"bit64":9223372036854775807}]')
            expect(parsed[0].bit64).toEqual('9223372036854775807')
        })

        // 32비트 정수를 그대로 유지한다
        it('keeps 32-bit integers as numbers', () => {
            const parsed = JsonUtil.parse('[{"bit32":123456}]')
            expect(parsed[0].bit32).toEqual(123456)
        })

        // 64비트 범위를 벗어날 때
        describe('when the value is outside the signed 64-bit range', () => {
            // 문자열로 변환하지 않는다
            it.each(['9223372036854775808', '-9223372036854775809'])('keeps %s unquoted', (raw) => {
                const parsed = JsonUtil.parse(`[{"bit64":${raw}}]`)
                expect(parsed[0].bit64).toEqual(Number(raw))
            })
        })

        // JSON.stringify(Date) 형식이 아닌 문자열은 그대로 유지한다
        it.each(['2023-06-18', '000000000000000000000000', '20230618T121234Z', '19990101'])(
            'does not convert %s to Date',
            (value) => {
                const parsed = JsonUtil.parse(`{"value":"${value}"}`)
                expect(parsed.value).toEqual(value)
            }
        )
    })

    describe('reviveDates', () => {
        // YYYY-MM-DDTHH:mm:ss.sssZ 형식을 Date 객체로 변환한다
        it('converts YYYY-MM-DDTHH:mm:ss.sssZ format to Date objects', () => {
            const converted = JsonUtil.reviveDates({ date: '2023-06-18T12:12:34.567Z' })

            expect(converted.date).toBeInstanceOf(Date)
            expect(converted.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        // 중첩 객체의 날짜 문자열을 재귀적으로 변환한다
        it('recursively converts date strings in nested objects', () => {
            const converted = JsonUtil.reviveDates({
                level1: {
                    date: '2023-06-18T12:12:34.567Z',
                    level2: { date: ['2023-06-19T12:12:34.567Z'], date2: nullDate, null: null }
                }
            })
            expect(converted.level1.date).toBeInstanceOf(Date)
            expect(converted.level1.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
            expect(converted.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
        })

        // JSON.stringify(Date) 형식이 아닌 값은 변환하지 않는다
        it.each([
            '2023-06-18',
            '2023-06-18T12:12:34',
            '2023-06-18T12:12:34.567',
            '20230618T121234Z',
            '19990101',
            '000000000000000000000000',
            'Hello, world!',
            123,
            true
        ])('does not convert %s', (value) => {
            const converted = JsonUtil.reviveDates({ value })
            expect(converted.value).toEqual(value)
        })
    })
})
