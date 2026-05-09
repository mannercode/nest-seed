import { generateShortId, pickIds } from '../id'

describe('generateShortId', () => {
    it('15자 짧은 ID를 생성한다', () => {
        const id = generateShortId()
        // nanoid는 일반적으로 A-Z, a-z, 0-9를 사용
        const regex = /^[A-Za-z0-9]{15}$/

        expect(id).toMatch(regex)
    })

    it('매번 고유한 ID를 생성한다', () => {
        const id1 = generateShortId()
        const id2 = generateShortId()

        expect(id1).not.toEqual(id2)
    })
})

describe('pickIds', () => {
    const items = [
        { id: '1', name: 'John' },
        { id: '2', name: 'Jane' },
        { id: '3', name: 'Bob' }
    ]

    describe('입력 배열에 항목이 있을 때', () => {
        it('id 값을 추출한다', () => {
            const result = pickIds(items)
            expect(result).toEqual(['1', '2', '3'])
        })
    })

    describe('입력 배열이 비어 있을 때', () => {
        it('빈 배열을 반환한다', () => {
            const result = pickIds([])
            expect(result).toEqual([])
        })
    })
})
