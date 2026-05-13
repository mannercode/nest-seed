import { nullDate } from '@mannercode/testing'
import { JsonUtil } from '../json'

describe('JsonUtil', () => {
    describe('parse', () => {
        it('밀리초 포함 ISO 8601 날짜 문자열을 Date 객체로 변환한다', () => {
            const parsed = JsonUtil.parse('{"date":"2023-06-18T12:12:34.567Z"}')

            expect(parsed.date).toBeInstanceOf(Date)
            expect(parsed.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        it('64비트 정수는 문자열로 변환한다 (배열 안 객체 포함)', () => {
            const parsed = JsonUtil.parse('[{"bit64":9223372036854775807}]')
            expect(parsed[0].bit64).toEqual('9223372036854775807')
        })

        it('32비트 정수는 숫자로 유지한다', () => {
            const parsed = JsonUtil.parse('[{"bit32":123456}]')
            expect(parsed[0].bit32).toEqual(123456)
        })

        it('int64 범위를 벗어난 정수는 숫자로 유지한다 (정밀도 손실)', () => {
            const over = JsonUtil.parse('[{"v":9223372036854775808}]')[0].v
            expect(over).toEqual(Number('9223372036854775808'))

            const under = JsonUtil.parse('[{"v":-9223372036854775809}]')[0].v
            expect(under).toEqual(Number('-9223372036854775809'))
        })

        it('ISO 8601 형식이 아닌 문자열은 Date 객체로 변환하지 않는다', () => {
            expect(JsonUtil.parse('{"v":"2023-06-18"}').v).toBe('2023-06-18')
            expect(JsonUtil.parse('{"v":"000000000000000000000000"}').v).toBe(
                '000000000000000000000000'
            )
            expect(JsonUtil.parse('{"v":"20230618T121234Z"}').v).toBe('20230618T121234Z')
            expect(JsonUtil.parse('{"v":"19990101"}').v).toBe('19990101')
        })

        it('경계값 MAX_SAFE_INTEGER 자체는 숫자로 유지한다', () => {
            const parsed = JsonUtil.parse(`[{"v":${Number.MAX_SAFE_INTEGER}}]`)
            expect(parsed[0].v).toBe(Number.MAX_SAFE_INTEGER)
            expect(typeof parsed[0].v).toBe('number')
        })
    })

    describe('reviveDates', () => {
        it('밀리초 포함 ISO 8601 문자열을 Date 객체로 변환한다', () => {
            const converted = JsonUtil.reviveDates({ date: '2023-06-18T12:12:34.567Z' })

            expect(converted.date).toBeInstanceOf(Date)
            expect(converted.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        it('중첩 객체와 배열 안의 날짜 문자열도 재귀적으로 변환한다', () => {
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

        it('Date.toISOString 형식과 다른 날짜 문자열은 변환하지 않는다', () => {
            expect(JsonUtil.reviveDates({ v: '2023-06-18' }).v).toBe('2023-06-18')
            expect(JsonUtil.reviveDates({ v: '2023-06-18T12:12:34' }).v).toBe('2023-06-18T12:12:34')
            expect(JsonUtil.reviveDates({ v: '2023-06-18T12:12:34.567' }).v).toBe(
                '2023-06-18T12:12:34.567'
            )
        })

        it('형식이 깨진 숫자 문자열은 변환하지 않는다', () => {
            expect(JsonUtil.reviveDates({ v: '20230618T121234Z' }).v).toBe('20230618T121234Z')
            expect(JsonUtil.reviveDates({ v: '19990101' }).v).toBe('19990101')
            expect(JsonUtil.reviveDates({ v: '000000000000000000000000' }).v).toBe(
                '000000000000000000000000'
            )
        })

        it('일반 문자열은 변환하지 않는다', () => {
            expect(JsonUtil.reviveDates({ v: 'Hello, world!' }).v).toBe('Hello, world!')
        })

        it('숫자나 불리언도 변환하지 않는다', () => {
            expect(JsonUtil.reviveDates({ v: 123 }).v).toBe(123)
            expect(JsonUtil.reviveDates({ v: true }).v).toBe(true)
        })

        it('밀리초가 없는 ISO 8601(예: "2023-01-01T00:00:00Z")은 Date 객체로 되살리지 않는다', () => {
            const result = JsonUtil.reviveDates({ v: '2023-01-01T00:00:00Z' })
            expect(result.v).toBe('2023-01-01T00:00:00Z')
        })

        it('Z 대신 +09:00 같은 타임존 오프셋이 붙은 ISO 8601은 Date 객체로 되살리지 않는다', () => {
            const result = JsonUtil.reviveDates({ v: '2023-01-01T00:00:00.000+09:00' })
            expect(result.v).toBe('2023-01-01T00:00:00.000+09:00')
        })
    })
})
