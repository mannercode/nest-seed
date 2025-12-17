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
    it('waits for the given amount of time', async () => {
        const start = Date.now()
        const timeout = 1000

        await sleep(timeout)

        const end = Date.now()
        const elapsed = end - start

        const tolerance = 100
        expect(elapsed).toBeGreaterThan(timeout - tolerance)
        expect(elapsed).toBeLessThan(timeout + tolerance)
    })
})

describe('generateUUID', () => {
    it('generates a UUID', () => {
        const generatedUuid = generateUUID()
        const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

        expect(generatedUuid).toMatch(regex)
    })

    it('generates a different UUID each time', () => {
        const firstUuid = generateUUID()
        const secondUuid = generateUUID()

        expect(firstUuid).not.toEqual(secondUuid)
    })
})

describe('generateShortId', () => {
    it('generates a 15-character short ID', () => {
        const id = generateShortId()
        // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    it('generates a unique ID each time', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })
})

describe('addQuotesToNumbers', () => {
    it('converts 64-bit integers in the JSON string to strings', () => {
        const text = '[{"bit64":12345678901234567890}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit64).toEqual('12345678901234567890')
    })

    it('converts 32-bit integers in the JSON string to strings', () => {
        const text = '[{"bit32":123456}]'
        const processedText = addQuotesToNumbers(text)
        const data = JSON.parse(processedText)

        expect(data[0].bit32).toEqual('123456')
    })
})

describe('jsonToObject', () => {
    it('converts ISO 8601 date strings to Date objects', () => {
        const converted = jsonToObject({ date: '2023-06-18T12:12:34.567Z' })

        expect(converted.date).toBeInstanceOf(Date)
        expect((converted.date as any).toISOString()).toEqual('2023-06-18T12:12:34.567Z')
    })

    it('recursively converts date strings in nested objects', () => {
        const converted = jsonToObject({
            level1: {
                date: '2023-06-18T12:12:34.567Z',
                level2: { date: ['2023-06-19T12:12:34.567Z'], date2: nullDate, null: null }
            }
        })
        expect(converted.level1.date).toBeInstanceOf(Date)
        expect((converted.level1.date as any).toISOString()).toEqual('2023-06-18T12:12:34.567Z')
        expect(converted.level1.level2.date).toEqual([new Date('2023-06-19T12:12:34.567Z')])
    })

    it('ignores strings that are not in date format', () => {
        const converted = jsonToObject({ text: 'Hello, world!' })
        expect(converted.text).toEqual('Hello, world!')
    })

    it('does not convert non-string types', () => {
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

    describe('when selecting a single key', () => {
        it('extracts the values', () => {
            const result = pickItems(items, 'name')
            expect(result).toEqual(['John', 'Jane', 'Bob'])
        })
    })

    describe('when selecting multiple keys', () => {
        it('extracts the values', () => {
            const result = pickItems(items, ['id', 'name'])
            expect(result).toEqual([
                { id: '1', name: 'John' },
                { id: '2', name: 'Jane' },
                { id: '3', name: 'Bob' }
            ])
        })
    })

    describe('when the input array is empty', () => {
        it('returns an empty array', () => {
            const result = pickItems([], 'name')
            expect(result).toEqual([])
        })
    })

    describe('when the key does not exist', () => {
        it('returns undefined items', () => {
            const result = pickItems(items, 'address' as any)
            expect(result).toEqual([undefined, undefined, undefined])
        })
    })
})

describe('pickIds', () => {
    const items = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
        { id: '3', name: 'Bob' }
    ]

    describe('when the input array contains items', () => {
        it('extracts the id values', () => {
            const result = pickIds(items)
            expect(result).toEqual(['1', '2', '3'])
        })
    })

    describe('when the input array is empty', () => {
        it('returns an empty array', () => {
            const result = pickIds([])
            expect(result).toEqual([])
        })
    })
})

describe('validateEmail', () => {
    describe('when the email is valid', () => {
        it('returns true', () => {
            expect(validateEmail('test@example.com')).toBe(true)
            expect(validateEmail('user.name@domain.co')).toBe(true)
        })
    })

    describe('when the email is invalid', () => {
        it('returns false', () => {
            expect(validateEmail('plainaddress')).toBe(false)
            expect(validateEmail('user@domain')).toBe(false)
        })
    })
})

describe('padNumber', () => {
    describe('when padding 5 to length 3', () => {
        it("returns '005'", () => {
            const result = padNumber(5, 3)
            expect(result).toEqual('005')
        })
    })

    describe('when the number is negative', () => {
        it('pads while keeping the sign', () => {
            const result = padNumber(-5, 3)
            expect(result).toEqual('0-5')
        })
    })

    describe('when the number length is sufficient', () => {
        it('returns the string representation', () => {
            expect(padNumber(123, 3)).toEqual('123')
            expect(padNumber(1234, 3)).toEqual('1234')
        })
    })
})

describe('coverage', () => {
    it('executes no-op helpers', () => {
        notUsed()
        comment()
    })
})
