import { generateShortId, pickIds } from '../id'

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

    it.todo('length가 0이면 빈 문자열을 반환한다')
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
