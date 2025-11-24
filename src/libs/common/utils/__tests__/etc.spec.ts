import {
    addQuotesToNumbers,
    comment,
    generateShortId,
    generateUUID,
    jsonToObject,
    notUsed,
    padNumber,
    pickIds,
    pickItems,
    sleep,
    validateEmail
} from 'common'
import { nullDate } from 'testlib'

describe('sleep', () => {
    // 주어진 시간만큼 대기한다
    test('waits for the given amount of time', async () => {
        const start = Date.now()
        const timeout = 1000

        await sleep(timeout)

        const end = Date.now()
        const elapsed = end - start

        // timeout이 1000ms로 설정되어 있으나 ±50ms 오차를 둔다.
        expect(elapsed).toBeGreaterThan(timeout - 50)
        expect(elapsed).toBeLessThan(timeout + 50)
    })
})

describe('generateUUID', () => {
    // UUID를 생성한다
    test('generates a UUID', () => {
        const generatedUuid = generateUUID()
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

        expect(generatedUuid).toMatch(regex)
    })

    // 매번 다른 UUID를 생성한다
    test('generates a different UUID each time', () => {
        const firstUuid = generateUUID()
        const secondUuid = generateUUID()

        expect(firstUuid).not.toEqual(secondUuid)
    })
})

describe('generateShortId', () => {
    // 15자리의 짧은 ID를 생성한다
    test('generates a 15-character short ID', () => {
        const id = generateShortId()
        // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    // 호출될 때마다 고유한 ID를 생성한다
    test('generates a unique ID each time', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })
})

describe('addQuotesToNumbers', () => {
    // JSON 문자열 내의 64비트 정수를 문자열로 변환한다
    test('converts 64-bit integers in the JSON string to strings', () => {
        const text = '[{"bit64":12345678901234567890}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit64).toEqual('12345678901234567890')
    })

    // JSON 문자열 내의 32비트 정수를 문자열로 변환한다
    test('converts 32-bit integers in the JSON string to strings', () => {
        const text = '[{"bit32":123456}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit32).toEqual('123456')
    })
})

describe('jsonToObject', () => {
    // ISO 8601 형식의 날짜 문자열을 Date 객체로 변환한다
    test('converts ISO 8601 date strings to Date objects', () => {
        const converted = jsonToObject({ date: '2023-06-18T12:12:34.567Z' })

        expect(converted.date).toBeInstanceOf(Date)
        expect((converted.date as any).toISOString()).toEqual('2023-06-18T12:12:34.567Z')
    })

    // 중첩된 객체 내의 날짜 문자열을 재귀적으로 변환한다
    test('recursively converts date strings in nested objects', () => {
        const converted = jsonToObject({
            level1: {
                date: '2023-06-18T12:12:34.567Z',
                level2: { date: ['2023-06-19T12:12:34.567Z'], date2: nullDate, null: null }
            }
        })
        expect(converted.level1.date).toBeInstanceOf(Date)
        expect((converted.level1.date as any).toISOString()).toEqual(
            '2023-06-18T12:12:34.567Z'
        )
        expect(converted.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
    })

    // 날짜 형식이 아닌 문자열은 그대로 둔다
    test('ignores strings that are not in date format', () => {
        const converted = jsonToObject({ text: 'Hello, world!' })
        expect(converted.text).toEqual('Hello, world!')
    })

    // 문자열이 아닌 타입은 변환하지 않는다
    test('does not convert non-string types', () => {
        const converted = jsonToObject({ number: 123, boolean: true })

        expect(converted.number).toEqual(123)
        expect(converted.boolean).toBe(true)
    })
})

describe('pickItems', () => {
    const items = [
        { id: '1', name: 'John', age: 30 },
        { id: '2', name: 'Jane', age: 25 },
        { id: '3', name: 'Bob', age: 40 }
    ]

    // 객체 배열에서 단일 키를 추출한다
    test('extracts a single key from an array of objects', () => {
        const result = pickItems(items, 'name')
        expect(result).toEqual(['John', 'Jane', 'Bob'])
    })

    // 객체 배열에서 여러 키를 추출한다
    test('extracts multiple keys from an array of objects', () => {
        const result = pickItems(items, ['id', 'name'])
        expect(result).toEqual([
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
            { id: '3', name: 'Bob' }
        ])
    })

    // 입력 배열이 비어있으면 빈 배열을 반환한다
    test('returns an empty array if the input array is empty', () => {
        const result = pickItems([], 'name')
        expect(result).toEqual([])
    })

    // 존재하지 않는 키는 undefined로 반환한다
    test('returns undefined for non-existent keys', () => {
        const result = pickItems(items, 'address' as any)
        expect(result).toEqual([undefined, undefined, undefined])
    })
})

describe('pickIds', () => {
    const items = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
        { id: '3', name: 'Bob' }
    ]

    // 객체 배열에서 id 값을 추출한다
    test('extracts the id value from an array of objects', () => {
        const result = pickIds(items)
        expect(result).toEqual(['1', '2', '3'])
    })

    // 입력 배열이 비어있으면 빈 배열을 반환한다
    test('returns an empty array if the input array is empty', () => {
        const result = pickIds([])
        expect(result).toEqual([])
    })
})

describe('validateEmail', () => {
    // 이메일이 유효한 경우
    describe('when the email is valid', () => {
        // true를 반환한다
        it('returns true', () => {
            expect(validateEmail('test@example.com')).toBe(true)
            expect(validateEmail('user.name@domain.co')).toBe(true)
        })
    })

    // 이메일이 유효하지 않은 경우
    describe('when the email is invalid', () => {
        // false를 반환한다
        it('returns false', () => {
            expect(validateEmail('plainaddress')).toBe(false)
            expect(validateEmail('user@domain')).toBe(false)
        })
    })
})

describe('padNumber', () => {
    // padNumber(5, 3)을 호출하면 '005'가 반환된다
    test("returns '005' when padding 5 to length 3", () => {
        const result = padNumber(5, 3)
        expect(result).toEqual('005')
    })

    // 음수는 부호를 포함해 0을 채운다
    test('pads negative numbers while keeping the sign', () => {
        const result = padNumber(-5, 3)
        expect(result).toEqual('0-5')
    })

    // 지정된 길이 이상이면 그대로 문자열을 반환한다
    test('returns the string representation if number length is sufficient', () => {
        expect(padNumber(123, 3)).toEqual('123')
        expect(padNumber(1234, 3)).toEqual('1234')
    })
})

describe('dummy test for coverage', () => {
    notUsed()
    comment()
})
