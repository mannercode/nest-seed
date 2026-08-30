import { JsonUtil } from '../json.js'

describe('JsonUtil', () => {
    describe('parse', () => {
        it('밀리초 포함 UTC 문자열을 Instant로 변환한다', () => {
            const parsed = JsonUtil.parse('{"date":"2023-06-18T12:12:34.567Z"}')

            expect(parsed.date).toBeInstanceOf(Temporal.Instant)
            expect(parsed.date.toString()).toEqual('2023-06-18T12:12:34.567Z')
        })

        it('날짜 전용 문자열을 PlainDate로 변환한다', () => {
            const parsed = JsonUtil.parse('{"date":"2023-06-18"}')

            expect(parsed.date).toBeInstanceOf(Temporal.PlainDate)
            expect(parsed.date.toString()).toBe('2023-06-18')
        })

        it('확장 연도 instant와 날짜 전용 문자열도 Temporal로 변환한다', () => {
            const parsed = JsonUtil.parse('{"at":"+010000-01-02T03:04:05Z","date":"-000001-12-31"}')

            expect(parsed.at).toEqual(Temporal.Instant.from('+010000-01-02T03:04:05Z'))
            expect(parsed.date).toEqual(Temporal.PlainDate.from('-000001-12-31'))
        })

        it('ISO 모양이지만 달력에 없는 날짜 문자열은 그대로 둔다', () => {
            const parsed = JsonUtil.parse('{"at":"2025-13-01T00:00:00Z","date":"2025-02-30"}')

            expect(parsed).toEqual({ at: '2025-13-01T00:00:00Z', date: '2025-02-30' })
        })

        it('Temporal 자체 JSON의 정각·나노초 instant도 밀리초로 복원한다', () => {
            const onSecond = JsonUtil.parse('{"at":"2023-06-18T12:12:34Z"}').at
            const nanos = JsonUtil.parse('{"at":"2023-06-18T12:12:34.123456789Z"}').at

            expect(onSecond.toString()).toBe('2023-06-18T12:12:34Z')
            expect(nanos.toString()).toBe('2023-06-18T12:12:34.123Z')
        })

        it('64비트 정수는 문자열로 변환한다 (배열 안 객체 포함)', () => {
            const parsed = JsonUtil.parse('[{"bit64":9223372036854775807}]')
            expect(parsed[0].bit64).toEqual('9223372036854775807')
        })

        it('32비트 정수는 숫자로 유지한다', () => {
            const parsed = JsonUtil.parse('[{"bit32":123456}]')
            expect(parsed[0].bit32).toEqual(123456)
        })

        it('문자열 리터럴 안의 긴 숫자는 건드리지 않는다', () => {
            const text = '{"note":"id:9223372036854775807,","v":9223372036854775807}'
            const parsed = JsonUtil.parse(text)
            expect(parsed.note).toBe('id:9223372036854775807,')
            expect(parsed.v).toBe('9223372036854775807')
        })

        it('int64 범위를 벗어난 정수는 숫자로 유지한다 (정밀도 손실)', () => {
            const over = JsonUtil.parse('[{"v":9223372036854775808}]')[0].v
            expect(over).toEqual(Number('9223372036854775808'))

            const under = JsonUtil.parse('[{"v":-9223372036854775809}]')[0].v
            expect(under).toEqual(Number('-9223372036854775809'))
        })

        it('Temporal JSON 형식이 아닌 문자열은 변환하지 않는다', () => {
            expect(JsonUtil.parse('{"v":"000000000000000000000000"}').v).toBe(
                '000000000000000000000000'
            )
            expect(JsonUtil.parse('{"v":"20230618T121234Z"}').v).toBe('20230618T121234Z')
            expect(JsonUtil.parse('{"v":"19990101"}').v).toBe('19990101')
        })

        it('문자열 안의 이스케이프된 따옴표를 건너뛰고 닫는 따옴표를 찾는다', () => {
            const text = '{"note":"say \\"9223372036854775807\\"","v":9223372036854775807}'
            const parsed = JsonUtil.parse(text)
            expect(parsed.note).toBe('say "9223372036854775807"')
            expect(parsed.v).toBe('9223372036854775807')
        })

        it('닫는 따옴표가 없는 문자열은 그대로 두어 JSON.parse가 SyntaxError를 던진다', () => {
            expect(() => JsonUtil.parse('{"v":"unterminated')).toThrow(SyntaxError)
        })

        it('소수·지수 표기는 정밀도 보존 대상이 아니므로 숫자로 유지한다', () => {
            expect(JsonUtil.parse('{"v":1.5}').v).toBe(1.5)
            expect(JsonUtil.parse('{"v":1.7976931348623157e308}').v).toBe(1.7976931348623157e308)
        })

        it('경계값 MAX_SAFE_INTEGER 자체는 숫자로 유지한다', () => {
            const parsed = JsonUtil.parse(`[{"v":${Number.MAX_SAFE_INTEGER}}]`)
            expect(parsed[0].v).toBe(Number.MAX_SAFE_INTEGER)
            expect(typeof parsed[0].v).toBe('number')
        })
    })

    describe('stringify', () => {
        it('Instant를 Date.toISOString과 같은 밀리초 3자리 JSON 계약으로 직렬화한다', () => {
            const at = Temporal.Instant.from('2023-06-18T12:12:34Z')

            expect(JsonUtil.stringify({ at })).toBe('{"at":"2023-06-18T12:12:34.000Z"}')
        })

        it('PlainDate는 YYYY-MM-DD 계약을 그대로 유지한다', () => {
            const date = Temporal.PlainDate.from('2023-06-18')

            expect(JsonUtil.stringify({ date })).toBe('{"date":"2023-06-18"}')
        })

        it('Temporal 값을 JSON 문자열로 왕복한다', () => {
            const input = {
                at: Temporal.Instant.from('2023-06-18T12:12:34.123456789Z'),
                date: Temporal.PlainDate.from('2023-06-18')
            }

            const output = JsonUtil.parse(JsonUtil.stringify(input))

            expect(output.at.toString()).toBe('2023-06-18T12:12:34.123Z')
            expect(output.date.equals(input.date)).toBe(true)
        })

        it('JSON 문자열로 표현할 수 없는 root 값은 명시적으로 거부한다', () => {
            expect(() => JsonUtil.stringify(undefined)).toThrow(TypeError)
        })
    })
})
