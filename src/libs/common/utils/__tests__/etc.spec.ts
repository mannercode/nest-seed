import {
    addQuotesToNumbers,
    comment,
    generateShortId,
    generateUUID,
    getChecksum,
    jsonToObject,
    notUsed,
    Path,
    pickIds,
    pickItems,
    sleep,
    validateEmail
} from 'common'
import fs from 'fs/promises'

describe('common/utils/etc', () => {
    describe('sleep', () => {
        it('주어진 시간만큼 대기해야 한다', async () => {
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
        it('UUID를 생성해야 한다', () => {
            const uuid = generateUUID()
            const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

            expect(uuid).toMatch(regex)
        })

        it('생성될 때마다 UUID가 달라야 한다', () => {
            const uuid1 = generateUUID()
            const uuid2 = generateUUID()

            expect(uuid1).not.toEqual(uuid2)
        })
    })

    describe('generateShortId', () => {
        it('15자리의 짧은 ID를 생성해야 한다', () => {
            const id = generateShortId()
            // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
            const regex = /^[A-Za-z0-9]{15}$/

            expect(id).toMatch(regex)
        })

        it('호출될 때마다 고유한 ID를 생성해야 한다', () => {
            const id1 = generateShortId()
            const id2 = generateShortId()

            expect(id1).not.toEqual(id2)
        })
    })

    describe('addQuotesToNumbers', () => {
        it('JSON 문자열 내의 64비트 정수를 문자열로 변환해야 한다', () => {
            const text = '[{"bit64":12345678901234567890}]'
            const processedText = addQuotesToNumbers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit64).toEqual('12345678901234567890')
        })

        it('JSON 문자열 내의 32비트 정수를 문자열로 변환해야 한다', () => {
            const text = '[{"bit32":123456}]'
            const processedText = addQuotesToNumbers(text)
            const data = JSON.parse(processedText)

            expect(data[0].bit32).toEqual('123456')
        })
    })

    describe('jsonToObject', () => {
        it('ISO 8601 형식의 날짜 문자열을 Date 객체로 변환해야 한다', () => {
            const obj = jsonToObject({
                date: '2023-06-18T12:00:00.000Z'
            })

            expect(obj.date).toBeInstanceOf(Date)
            expect((obj.date as any).toISOString()).toEqual('2023-06-18T12:00:00.000Z')
        })

        it('중첩된 객체 내의 날짜 문자열을 재귀적으로 변환해야 한다', () => {
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

        it('날짜 형식이 아닌 문자열은 무시해야 한다', () => {
            const obj = jsonToObject({
                text: 'Hello, world!'
            })
            expect(obj.text).toEqual('Hello, world!')
        })

        it('문자열이 아닌 타입은 변환하지 않아야 한다', () => {
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

        it('객체 배열에서 단일 키를 추출해야 한다', () => {
            const result = pickItems(items, 'name')
            expect(result).toEqual(['John', 'Jane', 'Bob'])
        })

        it('객체 배열에서 여러 키를 추출해야 한다', () => {
            const result = pickItems(items, ['id', 'name'])
            expect(result).toEqual([
                { id: '1', name: 'John' },
                { id: '2', name: 'Jane' },
                { id: '3', name: 'Bob' }
            ])
        })

        it('입력 배열이 비어있으면 빈 배열을 반환해야 한다', () => {
            const result = pickItems([], 'name')
            expect(result).toEqual([])
        })

        it('존재하지 않는 키를 처리할 때 에러 없이 undefined로 반환해야 한다', () => {
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

        it('객체 배열에서 id 값을 추출해야 한다', () => {
            const result = pickIds(items)
            expect(result).toEqual(['1', '2', '3'])
        })

        it('입력 배열이 비어있으면 빈 배열을 반환해야 한다', () => {
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

        it('정확한 MD5 체크섬을 반환해야 한다', async () => {
            const checksum = await getChecksum(helloWorld, 'md5')
            expect(checksum).toBe('65a8e27d8879283831b664bd8b7f0ad4')
        })

        it('정확한 SHA256 체크섬을 반환해야 한다', async () => {
            const checksum = await getChecksum(helloWorld)
            expect(checksum).toBe(
                'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
            )
        })
    })

    describe('validateEmail', () => {
        it('유효한 이메일 주소에 대해 true를 반환해야 한다', () => {
            expect(validateEmail('test@example.com')).toBe(true)
            expect(validateEmail('user.name@domain.co')).toBe(true)
        })

        it('유효하지 않은 이메일 주소에 대해 false를 반환해야 한다', () => {
            expect(validateEmail('plainaddress')).toBe(false)
            expect(validateEmail('user@domain')).toBe(false)
        })
    })
})

describe('for coverage', () => {
    notUsed()
    comment()
})
