import { expectEqualUnsorted } from '../expect-equal-unsorted'

describe('expectEqualUnsorted', () => {
    describe('비교가 성공할 때', () => {
        it('객체 배열을 순서 없이 비교한다', () => {
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

        it('빈 배열을 처리한다', () => {
            expect(() => expectEqualUnsorted([], [])).not.toThrow()
        })
    })

    describe('비교가 실패할 때', () => {
        it('내용이 다른 배열에 대해 오류를 던진다', () => {
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

        it('중첩 객체가 다른 배열에 대해 오류를 던진다', () => {
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

        it('인자가 undefined이면 오류를 던진다', () => {
            expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
            expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
        })
    })

    describe('특수 값', () => {
        it.todo('NaN 만 들어있는 두 배열을 같다고 판정한다 (또는 현 동작 명세대로 단언)')
        it.todo('배열-배열 (배열 안에 배열) 도 정렬 후 비교한다')
    })
})
