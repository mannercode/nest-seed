import { generateShortId, generateUuid, sha256, pickIds } from '../index.js'

describe('generateShortId', () => {
    it('기본 15자 길이의 알파벳/숫자 ID를 생성한다', () => {
        const id = generateShortId()
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    it('연속한 두 호출에서 서로 다른 ID를 생성한다', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })

    describe('ID 길이가 0이면', () => {
        let length: number
        beforeEach(() => {
            length = 0
        })
        it('ID를 생성하면 빈 문자열을 반환한다', () => {
            expect(generateShortId(length)).toBe('')
        })
    })
})

describe('pickIds', () => {
    const items = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
        { id: '3', name: 'Bob' }
    ]

    it('각 항목의 id 값을 배열로 추출한다', () => {
        const result = pickIds(items)
        expect(result).toEqual(['1', '2', '3'])
    })

    describe('항목 목록이 비어 있으면', () => {
        let items: { id: string }[]
        beforeEach(() => {
            items = []
        })
        it('ID를 추출하면 빈 배열을 반환한다', () => {
            const result = pickIds(items)
            expect(result).toEqual([])
        })
    })
})

describe('generateUuid', () => {
    it('UUID v4 형식을 사용하고 연속한 두 호출에서 서로 다른 값을 생성한다', () => {
        const first = generateUuid()
        expect(first).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        )
        expect(generateUuid()).not.toBe(first)
    })
})

describe('sha256', () => {
    describe.each([
        ['hex', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
        ['base64url', 'ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0']
    ] as const)('출력 인코딩이 %s이면', (encoding, expected) => {
        let outputEncoding: typeof encoding
        beforeEach(() => {
            outputEncoding = encoding
        })
        it('SHA-256 해시를 계산하면 지정한 인코딩으로 반환한다', () => {
            expect(sha256('abc', outputEncoding)).toBe(expected)
        })
    })
})
