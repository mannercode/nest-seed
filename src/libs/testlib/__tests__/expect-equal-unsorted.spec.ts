import { expectEqualUnsorted } from 'testlib'

describe('expectEqualUnsorted()', () => {
    // 상황: 비교에 성공하는 경우
    describe('when the comparison should succeed', () => {
        // 기대 결과: 순서가 다른 객체 배열을 성공적으로 비교한다.
        it('compares arrays of objects successfully regardless of order', () => {
            const actual = [
                { id: 1, name: 'John', age: 30 },
                { id: 2, name: 'Jane', age: 25 }
            ]
            const expected = [
                { id: 2, name: 'Jane', age: 25 },
                { id: 1, name: 'John', age: 30 }
            ]

            expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
        })

        // 기대 결과: expect.anything()을 사용한 필드를 무시하고 비교에 성공한다.
        it('ignores fields with expect.anything()', () => {
            const actual = [
                { id: expect.anything(), name: 'Jane', age: 25 },
                { id: expect.anything(), name: 'John', age: 30 }
            ]
            const expected = [
                { id: 1, name: 'Jane', age: 25 },
                { id: 2, name: 'John', age: 30 }
            ]

            expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
        })

        // 기대 결과: 빈 배열끼리 비교에 성공한다.
        it('handles empty arrays correctly', () => {
            expect(() => expectEqualUnsorted([], [])).not.toThrow()
        })
    })

    // 상황: 비교에 실패하여 예외를 던지는 경우
    describe('when the comparison should fail', () => {
        // 기대 결과: 배열의 내용이 다르면 예외를 던진다.
        it('throws an error if the array contents differ', () => {
            const actual = [
                { id: 1, name: 'John', age: 30 },
                { id: 2, name: 'Jane', age: 25 }
            ]
            const expected = [
                { id: 1, name: 'John', age: 40 },
                { id: 2, name: 'Jane', age: 25 }
            ]

            expect(() => expectEqualUnsorted(actual, expected)).toThrow()
        })

        // 기대 결과: 중첩된 객체의 내용이 다르면 예외를 던진다.
        it('throws an error if nested objects differ', () => {
            const actual = [
                { id: 1, name: 'John', address: { city: 'New York', zip: '-' } },
                { id: 2, name: 'Jane', address: { city: 'Los Angeles', zip: '90001' } }
            ]
            const expected = [
                { id: 1, name: 'John', address: { city: 'New York', zip: '10001' } },
                { id: 2, name: 'Jane', address: { city: 'Los Angeles', zip: '90001' } }
            ]

            expect(() => expectEqualUnsorted(actual, expected)).toThrow()
        })

        // 기대 결과: 배열 중 하나가 undefined이면 예외를 던진다.
        it('throws an error if either actual or expected is undefined', () => {
            expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
            expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
        })
    })
})
