import { expectEqualUnsorted } from '../expect-equal-unsorted'

describe('expectEqualUnsorted', () => {
    // 비교가 성공할 때
    describe('when the comparison succeeds', () => {
        // 객체 배열을 순서 없이 비교한다
        it('compares unordered arrays of objects', () => {
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

        // expect.anything 필드를 무시한다
        it('ignores fields with expect.anything', () => {
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

        // 빈 배열을 처리한다
        it('handles empty arrays', () => {
            expect(() => expectEqualUnsorted([], [])).not.toThrow()
        })
    })

    // 비교가 실패할 때
    describe('when the comparison fails', () => {
        // 내용이 다른 배열에 대해 오류를 던진다
        it('throws an error for arrays with different content', () => {
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

        // 중첩 객체가 다른 배열에 대해 오류를 던진다
        it('throws an error for arrays with different nested objects', () => {
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

        // 인자가 undefined이면 오류를 던진다
        it('throws an error when an argument is undefined', () => {
            expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
            expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
        })
    })
})
