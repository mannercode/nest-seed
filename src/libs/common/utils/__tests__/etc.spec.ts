import {
    quoteJsonIntegers,
    generateShortId,
    generateUUID,
    reviveIsoDates,
    padNumber,
    pickIds,
    sleep,
    validateEmail
} from 'common'
import { nullDate } from 'testlib'

describe('sleep', () => {
    // 지정된 시간만큼 대기한다
    it('waits for the given amount of time', async () => {
        const start = Date.now()
        const timeout = 1000

        await sleep(timeout)

        const end = Date.now()
        const elapsed = end - start

        const tolerance = 500
        expect(elapsed).toBeGreaterThan(timeout - tolerance)
        expect(elapsed).toBeLessThan(timeout + tolerance)
    })
})

describe('generateUUID', () => {
    // UUID를 생성한다
    it('generates a UUID', () => {
        const generatedUuid = generateUUID()
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

        expect(generatedUuid).toMatch(regex)
    })

    // 매번 다른 UUID를 생성한다
    it('generates a different UUID each time', () => {
        const firstUuid = generateUUID()
        const secondUuid = generateUUID()

        expect(firstUuid).not.toEqual(secondUuid)
    })
})

describe('generateShortId', () => {
    // 15자 짧은 ID를 생성한다
    it('generates a 15-character short ID', () => {
        const id = generateShortId()
        // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    // 매번 고유한 ID를 생성한다
    it('generates a unique ID each time', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })
})

describe('quoteJsonIntegers', () => {
    // JSON 문자열의 64비트 정수를 문자열로 변환한다
    it('converts 64-bit integers in the JSON string to strings', () => {
        const text = '[{"bit64":9223372036854775807}]'
        const processedText = quoteJsonIntegers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit64).toEqual('9223372036854775807')
    })

    // JSON 문자열의 32비트 정수를 그대로 유지한다
    it('keeps 32-bit integers as numbers', () => {
        const text = '[{"bit32":123456}]'
        const processedText = quoteJsonIntegers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit32).toEqual(123456)
    })

    // 64비트 범위를 벗어날 때
    describe('when the value is outside the signed 64-bit range', () => {
        // 문자열로 변환하지 않는다
        it.each(['9223372036854775808', '-9223372036854775809'])('keeps %s unquoted', (raw) => {
            const text = `[{"bit64":${raw}}]`
            const processedText = quoteJsonIntegers(text)

            expect(processedText).toEqual(text)
        })
    })
})

describe('reviveIsoDates', () => {
    // ISO 8601 날짜 문자열을 Date 객체로 변환한다
    it('converts ISO 8601 date strings to Date objects', () => {
        const converted = reviveIsoDates({ date: '2023-06-18T12:12:34.567Z' })

        expect(converted.date).toBeInstanceOf(Date)
        expect(converted.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
    })

    // 중첩 객체의 날짜 문자열을 재귀적으로 변환한다
    it('recursively converts date strings in nested objects', () => {
        const converted = reviveIsoDates({
            level1: {
                date: '2023-06-18T12:12:34.567Z',
                level2: { date: ['2023-06-19T12:12:34.567Z'], date2: nullDate, null: null }
            }
        })
        expect(converted.level1.date).toBeInstanceOf(Date)
        expect(converted.level1.date.toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        expect(converted.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
    })

    // 날짜 형식이 아닌 문자열은 무시한다
    it('ignores strings that are not in date format', () => {
        const converted = reviveIsoDates({ text: 'Hello, world!' })
        expect(converted.text).toEqual('Hello, world!')
    })

    // 문자열이 아닌 타입은 변환하지 않는다
    it('does not convert non-string types', () => {
        const converted = reviveIsoDates({ number: 123, boolean: true })

        expect(converted.number).toEqual(123)
        expect(converted.boolean).toBe(true)
    })
})

describe('pickIds', () => {
    const items = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
        { id: '3', name: 'Bob' }
    ]

    // 입력 배열에 항목이 있을 때
    describe('when the input array contains items', () => {
        // id 값을 추출한다
        it('extracts the id values', () => {
            const result = pickIds(items)
            expect(result).toEqual(['1', '2', '3'])
        })
    })

    // 입력 배열이 비어 있을 때
    describe('when the input array is empty', () => {
        // 빈 배열을 반환한다
        it('returns an empty array', () => {
            const result = pickIds([])
            expect(result).toEqual([])
        })
    })
})

describe('validateEmail', () => {
    // 이메일이 유효할 때
    describe('when the email is valid', () => {
        // true를 반환한다
        it('returns true', () => {
            expect(validateEmail('test@example.com')).toBe(true)
            expect(validateEmail('user.name@domain.co')).toBe(true)
        })
    })

    // 이메일이 유효하지 않을 때
    describe('when the email is invalid', () => {
        // false를 반환한다
        it('returns false', () => {
            expect(validateEmail('plainaddress')).toBe(false)
            expect(validateEmail('user@domain')).toBe(false)
        })
    })
})

describe('padNumber', () => {
    // 길이 3으로 5를 패딩할 때
    describe('when padding 5 to length 3', () => {
        // '005'를 반환한다
        it("returns '005'", () => {
            const result = padNumber(5, 3)
            expect(result).toEqual('005')
        })
    })

    // 숫자가 음수일 때
    describe('when the number is negative', () => {
        // 부호를 유지한 채 패딩한다
        it('pads while keeping the sign', () => {
            const result = padNumber(-5, 3)
            expect(result).toEqual('0-5')
        })
    })

    // 숫자 길이가 충분할 때
    describe('when the number length is sufficient', () => {
        // 문자열 표현을 반환한다
        it('returns the string representation', () => {
            expect(padNumber(123, 3)).toEqual('123')
            expect(padNumber(1234, 3)).toEqual('1234')
        })
    })
})
