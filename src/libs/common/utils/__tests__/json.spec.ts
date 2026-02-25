import { Json } from 'common'
import { nullDate } from 'testlib'

describe('Json', () => {
    describe('quoteIntegers', () => {
        // JSON 문자열의 64비트 정수를 문자열로 변환한다
        it('converts 64-bit integers in the JSON string to strings', () => {
            const text = '[{"bit64":9223372036854775807}]'
            const processedText = Json.quoteIntegers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit64).toEqual('9223372036854775807')
        })

        // JSON 문자열의 32비트 정수를 그대로 유지한다
        it('keeps 32-bit integers as numbers', () => {
            const text = '[{"bit32":123456}]'
            const processedText = Json.quoteIntegers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit32).toEqual(123456)
        })

        // 64비트 범위를 벗어날 때
        describe('when the value is outside the signed 64-bit range', () => {
            // 문자열로 변환하지 않는다
            it.each(['9223372036854775808', '-9223372036854775809'])(
                'keeps %s unquoted',
                (raw) => {
                    const text = `[{"bit64":${raw}}]`
                    const processedText = Json.quoteIntegers(text)

                    expect(processedText).toEqual(text)
                }
            )
        })
    })

    describe('reviveIsoDates', () => {
        // ISO 8601 날짜 문자열을 Date 객체로 변환한다
        it('converts ISO 8601 date strings to Date objects', () => {
            const converted = Json.reviveIsoDates({ date: '2023-06-18T12:12:34.567Z' })

            expect(converted.date).toBeInstanceOf(Date)
            expect(converted.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        // 중첩 객체의 날짜 문자열을 재귀적으로 변환한다
        it('recursively converts date strings in nested objects', () => {
            const converted = Json.reviveIsoDates({
                level1: {
                    date: '2023-06-18T12:12:34.567Z',
                    level2: {
                        date: ['2023-06-19T12:12:34.567Z'],
                        date2: nullDate,
                        null: null
                    }
                }
            })
            expect(converted.level1.date).toBeInstanceOf(Date)
            expect(converted.level1.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
            expect(converted.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
        })

        // 날짜 형식이 아닌 문자열은 무시한다
        it('ignores strings that are not in date format', () => {
            const converted = Json.reviveIsoDates({ text: 'Hello, world!' })
            expect(converted.text).toEqual('Hello, world!')
        })

        // 문자열이 아닌 타입은 변환하지 않는다
        it('does not convert non-string types', () => {
            const converted = Json.reviveIsoDates({ boolean: true, number: 123 })

            expect(converted.number).toEqual(123)
            expect(converted.boolean).toBe(true)
        })
    })
})
