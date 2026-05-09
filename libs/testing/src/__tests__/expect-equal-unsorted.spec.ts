import { expectEqualUnsorted } from '../expect-equal-unsorted'

describe('expectEqualUnsorted', () => {
    it('객체 배열을 순서와 무관하게 같다고 판정한다', () => {
        const actual = [
            { age: 30, id: 1, name: 'John' },
            { age: 25, id: 2, name: 'Jane' }
        ]
        const expected = [
            { age: 25, id: 2, name: 'Jane' },
            { age: 30, id: 1, name: 'John' }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
    })

    it('expect.anything 필드를 무시한다', () => {
        const actual = [
            { age: 25, id: expect.anything(), name: 'Jane' },
            { age: 30, id: expect.anything(), name: 'John' }
        ]
        const expected = [
            { age: 25, id: 1, name: 'Jane' },
            { age: 30, id: 2, name: 'John' }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
    })

    it('빈 배열끼리는 같다고 판정한다', () => {
        expect(() => expectEqualUnsorted([], [])).not.toThrow()
    })

    it('내용이 다른 배열은 예외를 던진다', () => {
        const actual = [
            { age: 30, id: 1, name: 'John' },
            { age: 25, id: 2, name: 'Jane' }
        ]
        const expected = [
            { age: 40, id: 1, name: 'John' },
            { age: 25, id: 2, name: 'Jane' }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).toThrow()
    })

    it('중첩 객체가 다르면 예외를 던진다', () => {
        const actual = [
            { address: { city: 'New York', zip: '-' }, id: 1, name: 'John' },
            { address: { city: 'Los Angeles', zip: '90001' }, id: 2, name: 'Jane' }
        ]
        const expected = [
            { address: { city: 'New York', zip: '10001' }, id: 1, name: 'John' },
            { address: { city: 'Los Angeles', zip: '90001' }, id: 2, name: 'Jane' }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).toThrow()
    })

    it('actual이나 expected가 undefined이면 예외를 던진다', () => {
        expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
        expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
    })

    it('NaN만 들어 있는 두 배열을 같다고 판정한다', () => {
        // JSON.stringify(NaN)은 "null"이라 정렬 키가 같아진다.
        expect(() => expectEqualUnsorted([{ v: NaN }], [{ v: NaN }])).not.toThrow()
    })

    it('중첩 배열도 정렬 후 비교한다', () => {
        const actual = [
            { id: 1, items: [3, 1, 2] },
            { id: 2, items: ['c', 'a', 'b'] }
        ]
        const expected = [
            { id: 2, items: ['c', 'a', 'b'] },
            { id: 1, items: [3, 1, 2] }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
    })
})
