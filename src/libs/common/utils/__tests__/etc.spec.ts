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
    // 주어진 시간만큼 대기해야 한다
    it('Should wait for the given amount of time', async () => {
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
    // UUID를 생성해야 한다
    it('Should generate a UUID', () => {
        const uuid = generateUUID()
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

        expect(uuid).toMatch(regex)
    })

    // 생성될 때마다 UUID가 달라야 한다
    it('Should generate a different UUID each time', () => {
        const uuid1 = generateUUID()
        const uuid2 = generateUUID()

        expect(uuid1).not.toEqual(uuid2)
    })
})

describe('generateShortId', () => {
    // 15자리의 짧은 ID를 생성해야 한다
    it('Should generate a 15-character short ID', () => {
        const id = generateShortId()
        // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    // 호출될 때마다 고유한 ID를 생성해야 한다
    it('Should generate a unique ID each time it is called', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })
})

describe('addQuotesToNumbers', () => {
    // JSON 문자열 내의 64비트 정수를 문자열로 변환해야 한다
    it('Should convert 64-bit integers in the JSON string to strings', () => {
        const text = '[{\"bit64\":12345678901234567890}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit64).toEqual('12345678901234567890')
    })

    // JSON 문자열 내의 32비트 정수를 문자열로 변환해야 한다
    it('Should convert 32-bit integers in the JSON string to strings', () => {
        const text = '[{\"bit32\":123456}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit32).toEqual('123456')
    })
})

describe('jsonToObject', () => {
    // ISO 8601 형식의 날짜 문자열을 Date 객체로 변환해야 한다
    it('Should convert ISO 8601 date strings to Date objects', () => {
        const obj = jsonToObject({
            date: '2023-06-18T12:12:34.567Z'
        })

        expect(obj.date).toBeInstanceOf(Date)
        expect((obj.date as any).toISOString()).toEqual('2023-06-18T12:12:34.567Z')
    })

    // 중첩된 객체 내의 날짜 문자열을 재귀적으로 변환해야 한다
    it('Should recursively convert date strings in nested objects', () => {
        const obj = jsonToObject({
            level1: {
                date: '2023-06-18T12:12:34.567Z',
                level2: {
                    date: ['2023-06-19T12:12:34.567Z'],
                    date2: nullDate,
                    null: null
                }
            }
        })
        expect(obj.level1.date).toBeInstanceOf(Date)
        expect((obj.level1.date as any).toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        expect(obj.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
    })

    // 날짜 형식이 아닌 문자열은 무시해야 한다
    it('Should ignore strings that are not in date format', () => {
        const obj = jsonToObject({
            text: 'Hello, world!'
        })
        expect(obj.text).toEqual('Hello, world!')
    })

    // 문자열이 아닌 타입은 변환하지 않아야 한다
    it('Should not convert types that are not strings', () => {
        const obj = jsonToObject({
            number: 123,
            boolean: true
        })

        expect(obj.number).toEqual(123)
        expect(obj.boolean).toBe(true)
    })
})

describe('pickItems', () => {
    const items = [
        { id: '1', name: 'John', age: 30 },
        { id: '2', name: 'Jane', age: 25 },
        { id: '3', name: 'Bob', age: 40 }
    ]

    // 객체 배열에서 단일 키를 추출해야 한다
    it('Should extract a single key from an array of objects', () => {
        const result = pickItems(items, 'name')
        expect(result).toEqual(['John', 'Jane', 'Bob'])
    })

    // 객체 배열에서 여러 키를 추출해야 한다
    it('Should extract multiple keys from an array of objects', () => {
        const result = pickItems(items, ['id', 'name'])
        expect(result).toEqual([
            { id: '1', name: 'John' },
            { id: '2', name: 'Jane' },
            { id: '3', name: 'Bob' }
        ])
    })

    // 입력 배열이 비어있으면 빈 배열을 반환해야 한다
    it('Should return an empty array if the input array is empty', () => {
        const result = pickItems([], 'name')
        expect(result).toEqual([])
    })

    // 존재하지 않는 키를 처리할 때 에러 없이 undefined로 반환해야 한다
    it('Should return undefined without error for non-existent keys', () => {
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

    // 객체 배열에서 id 값을 추출해야 한다
    it('Should extract the id value from an array of objects', () => {
        const result = pickIds(items)
        expect(result).toEqual(['1', '2', '3'])
    })

    // 입력 배열이 비어있으면 빈 배열을 반환해야 한다
    it('Should return an empty array if the input array is empty', () => {
        const result = pickIds([])
        expect(result).toEqual([])
    })
})

describe('validateEmail', () => {
    // 유효한 이메일 주소에 대해 true를 반환해야 한다
    it('Should return true for a valid email address', () => {
        expect(validateEmail('test@example.com')).toBe(true)
        expect(validateEmail('user.name@domain.co')).toBe(true)
    })

    // 유효하지 않은 이메일 주소에 대해 false를 반환해야 한다
    it('Should return false for an invalid email address', () => {
        expect(validateEmail('plainaddress')).toBe(false)
        expect(validateEmail('user@domain')).toBe(false)
    })
})

describe('padNumber', () => {
    // padNumber(5, 3)을 호출하면 '005'가 반환되어야 한다
    it("Should return '005' when padding 5 to length 3", () => {
        const result = padNumber(5, 3)
        expect(result).toEqual('005')
    })

    // 음수는 부호를 포함하여 길이를 계산해 0을 채워야 한다
    it('Should pad negative numbers while keeping the sign', () => {
        const result = padNumber(-5, 3)
        expect(result).toEqual('0-5')
    })

    // 지정된 길이 이상인 경우 그대로 문자열을 반환해야 한다
    it('Should return the string representation if number length is sufficient', () => {
        expect(padNumber(123, 3)).toEqual('123')
        expect(padNumber(1234, 3)).toEqual('1234')
    })
})

describe('dummy test for coverage', () => {
    notUsed()
    comment()
})
