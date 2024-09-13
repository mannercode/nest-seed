import { LatLong } from 'common'
import * as fs from 'fs/promises'
import {
    Password,
    Path,
    addQuotesToNumbers,
    comment,
    equalsIgnoreCase,
    generateUUID,
    getChecksum,
    jsonToObject,
    latlongDistanceInMeters,
    maps,
    notUsed,
    pickIds,
    pickItems,
    sleep
} from '..'

describe('common/utils/etc', () => {
    describe('sleep', () => {
        it('sleeps for the given amount of time', async () => {
            const start = Date.now()
            const timeout = 1000

            await sleep(timeout)

            const end = Date.now()
            const elapsed = end - start

            // Since the timeout is set to 1000, it should execute around 1000, so the range is set to +-100
            expect(elapsed).toBeGreaterThan(timeout - 100)
            expect(elapsed).toBeLessThan(timeout + 100)
        })
    })

    describe('generateUUID', () => {
        it('generates a UUID', () => {
            const uuid = generateUUID()
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

            expect(uuid).toMatch(regex)
        })

        it('UUID should be different each time it is generated', () => {
            const uuid1 = generateUUID()
            const uuid2 = generateUUID()

            expect(uuid1).not.toEqual(uuid2)
        })
    })

    describe('Password', () => {
        it('hashes the password', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            expect(hashedPassword).not.toEqual(password)
        })

        it('returns true if the password matches', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            const isValidPassword = await Password.validate(password, hashedPassword)

            expect(isValidPassword).toBeTruthy()
        })

        it('returns false if the password does not match', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            const isValidPassword = await Password.validate('wrongpassword', hashedPassword)

            expect(isValidPassword).toBeFalsy()
        })
    })

    describe('latlongDistanceInMeters', () => {
        it('calculates the distance between two latlong in meters', () => {
            // latlong for Seoul, South Korea
            const seoul: LatLong = {
                latitude: 37.5665,
                longitude: 126.978
            }

            // latlong for Busan, South Korea
            const busan: LatLong = {
                latitude: 35.1796,
                longitude: 129.0756
            }

            // approximate distance in meters between Seoul and Busan
            // it's about 325 km, but the actual value can vary based on the exact latlong
            const expectedDistance = 325000

            // get the result from our function
            const actualDistance = latlongDistanceInMeters(seoul, busan)

            // define our tolerance (5% in this case)
            const tolerance = 0.05 * expectedDistance

            // check if the actual distance is within the expected range
            expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
            expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
        })
    })

    describe('addQuotesToNumbers', () => {
        it('converts 64-bit integers to strings in a JSON string', () => {
            const text = '[{"bit64":12345678901234567890}]'
            const processedText = addQuotesToNumbers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit64).toEqual('12345678901234567890')
        })

        it('converts 32-bit integers to strings in a JSON string', () => {
            const text = '[{"bit32":123456}]'
            const processedText = addQuotesToNumbers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit32).toEqual('123456')
        })
    })

    describe('equalsIgnoreCase', () => {
        it('returns true for two strings with different case', () => {
            const isEqual = equalsIgnoreCase('hello', 'HELLO')

            expect(isEqual).toBeTruthy()
        })

        it('returns false if the two strings are different', () => {
            const isEqual = equalsIgnoreCase('hello', 'world')

            expect(isEqual).toBeFalsy()
        })

        it('returns false if both inputs are undefined', () => {
            const isEqual = equalsIgnoreCase(undefined, undefined)

            expect(isEqual).toBeFalsy()
        })
    })

    describe('jsonToObject', () => {
        it('converts ISO 8601 date strings to Date objects', () => {
            const obj = jsonToObject({
                date: '2023-06-18T12:00:00.000Z'
            })

            expect(obj.date).toBeInstanceOf(Date)
            expect((obj.date as any).toISOString()).toEqual('2023-06-18T12:00:00.000Z')
        })

        it('recursively converts date strings in nested objects', () => {
            const obj = jsonToObject({
                level1: {
                    date: '2023-06-18T12:00:00.000Z',
                    level2: {
                        date: ['2023-06-19T12:00:00.000Z'],
                        date2: new Date(0),
                        null: null
                    }
                }
            })
            expect(obj.level1.date).toBeInstanceOf(Date)
            expect((obj.level1.date as any).toISOString()).toEqual('2023-06-18T12:00:00.000Z')
            expect(obj.level1.level2.date).toEqual([new Date('2023-06-19T12:00:00.000Z')])
        })

        it('ignores non-date string formats', () => {
            const obj = jsonToObject({
                text: 'Hello, world!'
            })
            expect(obj.text).toEqual('Hello, world!')
        })

        it('ignores non-string types', () => {
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

        it('should pick a single key from array of objects', () => {
            const result = pickItems(items, 'name')
            expect(result).toEqual(['John', 'Jane', 'Bob'])
        })

        it('should pick multiple keys from array of objects', () => {
            const result = pickItems(items, ['id', 'name'])
            expect(result).toEqual([
                { id: '1', name: 'John' },
                { id: '2', name: 'Jane' },
                { id: '3', name: 'Bob' }
            ])
        })

        it('should return an empty array if input array is empty', () => {
            const result = pickItems([], 'name')
            expect(result).toEqual([])
        })

        it('should handle non-existent keys gracefully', () => {
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

        it('should pick ids from array of objects', () => {
            const result = pickIds(items)
            expect(result).toEqual(['1', '2', '3'])
        })

        it('should return an empty array if input array is empty', () => {
            const result = pickIds([])
            expect(result).toEqual([])
        })
    })

    describe('getChecksum', () => {
        const testContent = 'Hello, World!'
        let tempDir: string
        let helloWorld: string

        beforeEach(async () => {
            tempDir = await Path.createTempDirectory()
            helloWorld = Path.join(tempDir, 'test-file.txt')
            await fs.writeFile(helloWorld, testContent)
        })

        afterEach(async () => {
            await Path.delete(tempDir)
        })

        it('should return correct MD5 checksum', async () => {
            const checksum = await getChecksum(helloWorld, 'md5')
            expect(checksum).toBe('65a8e27d8879283831b664bd8b7f0ad4')
        })

        it('should return correct SHA256 checksum', async () => {
            const checksum = await getChecksum(helloWorld)
            expect(checksum).toBe(
                'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
            )
        })
    })

    describe('maps', () => {
        class Source {
            constructor(
                public id: number,
                public name: string
            ) {}
        }

        class Target {
            id: number
            upperName: string

            constructor(source: Source) {
                this.id = source.id
                this.upperName = source.name.toUpperCase()
            }
        }

        it('should correctly map an array of objects to target class instances', () => {
            const sources = [new Source(1, 'alice'), new Source(2, 'bob')]

            const results = maps(sources, Target)

            expect(results).toHaveLength(2)
            expect(results[0]).toBeInstanceOf(Target)
            expect(results[0]).toEqual({ id: 1, upperName: 'ALICE' })
            expect(results[1]).toEqual({ id: 2, upperName: 'BOB' })
        })

        it('should return an empty array when given an empty array', () => {
            expect(maps([], Target)).toEqual([])
        })
    })
    describe('for coverage', () => {
        notUsed()
        comment()
    })
})
