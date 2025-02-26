import {
    LatLong,
    Password,
    Path,
    addQuotesToNumbers,
    Byte,
    comment,
    generateShortId,
    generateUUID,
    getChecksum,
    jsonToObject,
    latlongDistanceInMeters,
    notUsed,
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

            // timeout이 1000ms로 설정되어 있으므로, 실제 대기 시간은 ±100ms 범위 내여야 한다
            expect(elapsed).toBeGreaterThan(timeout - 100)
            expect(elapsed).toBeLessThan(timeout + 100)
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
        it('10자리의 짧은 ID를 생성해야 한다', () => {
            const id = generateShortId()
            // nanoid는 일반적으로 A-Z, a-z, 0-9, _ 및 -를 사용
            const regex = /^[A-Za-z0-9_-]{10}$/

            expect(id).toMatch(regex)
        })

        it('호출될 때마다 고유한 ID를 생성해야 한다', () => {
            const id1 = generateShortId()
            const id2 = generateShortId()

            expect(id1).not.toEqual(id2)
        })
    })

    describe('Password', () => {
        it('비밀번호를 해싱해야 한다', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            expect(hashedPassword).not.toEqual(password)
        })

        it('비밀번호가 일치하면 true를 반환해야 한다', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            const isValidPassword = await Password.validate(password, hashedPassword)

            expect(isValidPassword).toBeTruthy()
        })

        it('비밀번호가 일치하지 않으면 false를 반환해야 한다', async () => {
            const password = 'password'
            const hashedPassword = await Password.hash(password)

            const isValidPassword = await Password.validate('wrongpassword', hashedPassword)

            expect(isValidPassword).toBeFalsy()
        })
    })

    describe('latlongDistanceInMeters', () => {
        it('두 위경도 간의 거리를 미터 단위로 계산해야 한다', () => {
            // 서울의 위경도
            const seoul: LatLong = {
                latitude: 37.5665,
                longitude: 126.978
            }

            // 부산의 위경도
            const busan: LatLong = {
                latitude: 35.1796,
                longitude: 129.0756
            }

            // 서울과 부산 사이의 대략적인 거리 (약 325km)
            const expectedDistance = 325000

            // 함수로부터 실제 거리를 구함
            const actualDistance = latlongDistanceInMeters(seoul, busan)

            // 오차 범위(5%)를 설정
            const tolerance = 0.05 * expectedDistance

            // 실제 거리가 예상 범위 내에 있는지 확인
            expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
            expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
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

    describe('Byte', () => {
        describe('fromString', () => {
            it('유효한 크기 문자열을 바이트 단위 숫자로 변환해야 한다', () => {
                expect(Byte.fromString('1024B')).toEqual(1024)
                expect(Byte.fromString('1KB')).toEqual(1024)
                expect(Byte.fromString('1MB')).toEqual(1024 * 1024)
                expect(Byte.fromString('1GB')).toEqual(1024 * 1024 * 1024)
                expect(Byte.fromString('1TB')).toEqual(1024 * 1024 * 1024 * 1024)
                expect(Byte.fromString('1KB 512B')).toEqual(1536)
                expect(Byte.fromString('1.5KB')).toEqual(1536)
                expect(Byte.fromString('-1KB')).toEqual(-1024)
                expect(Byte.fromString('1GB 256MB 128KB')).toEqual(
                    1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024
                )
            })

            it('소문자 단위의 문자열을 바이트로 변환해야 한다', () => {
                expect(Byte.fromString('1024b')).toEqual(1024)
                expect(Byte.fromString('1kb')).toEqual(1024)
                expect(Byte.fromString('1mb')).toEqual(1024 * 1024)
                expect(Byte.fromString('1gb')).toEqual(1024 * 1024 * 1024)
                expect(Byte.fromString('1tb')).toEqual(1024 * 1024 * 1024 * 1024)
            })

            it('잘못된 형식인 경우 에러를 발생시켜야 한다', () => {
                expect(() => Byte.fromString('invalid')).toThrow()
                expect(() => Byte.fromString('123')).toThrow()
                expect(() => Byte.fromString('123XB')).toThrow()
                expect(() => Byte.fromString('1KB -')).toThrow()
            })
        })

        describe('toString', () => {
            it('바이트 값을 사람이 읽기 쉬운 문자열로 변환해야 한다', () => {
                expect(Byte.toString(0)).toEqual('0B')
                expect(Byte.toString(1024)).toEqual('1KB')
                expect(Byte.toString(1536)).toEqual('1KB512B')
                expect(Byte.toString(1024 * 1024)).toEqual('1MB')
                expect(Byte.toString(1024 * 1024 * 1.5)).toEqual('1MB512KB')
                expect(Byte.toString(-1024)).toEqual('-1KB')
                expect(
                    Byte.toString(1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024)
                ).toEqual('1GB256MB128KB')
            })
        })
    })
})

describe('for coverage', () => {
    notUsed()
    comment()
})
