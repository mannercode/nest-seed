import { expectEqualUnsorted } from 'testlib'

describe('expectEqualUnsorted', () => {
    describe('when the comparison succeeds', () => {
        it('compares unordered arrays of objects', () => {
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

        it('ignores fields with expect.anything', () => {
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

        it('handles empty arrays', () => {
            expect(() => expectEqualUnsorted([], [])).not.toThrow()
        })
    })

    describe('when the comparison fails', () => {
        it('throws an error for arrays with different content', () => {
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

        it('throws an error for arrays with different nested objects', () => {
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

        it('throws an error when an argument is undefined', () => {
            expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
            expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
        })
    })
})
