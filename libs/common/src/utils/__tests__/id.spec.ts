import { generateShortId, generateUuid, sha256, pickIds } from '../index.js'

describe('generateShortId', () => {
    it('기본 15자 길이의 알파벳/숫자 ID를 생성한다', () => {
        const id = generateShortId()
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    it('매번 다른 ID를 생성한다', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })

    it('length가 0이면 빈 문자열을 반환한다', () => {
        expect(generateShortId(0)).toBe('')
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

    it('빈 배열이면 빈 배열을 반환한다', () => {
        const result = pickIds([])
        expect(result).toEqual([])
    })
})

describe('generateUuid', () => {
    it('매번 다른 UUID v4를 생성한다', () => {
        const first = generateUuid()
        expect(first).toMatch(
            /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        )
        expect(generateUuid()).not.toBe(first)
    })
})

describe('sha256', () => {
    it('같은 입력을 요청한 인코딩으로 해시한다', () => {
        expect(sha256('abc', 'hex')).toBe(
            'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
        )
        expect(sha256('abc', 'base64url')).toBe('ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0')
    })
})
