import { expectEqualUnsorted } from '..'

describe('expectEqualUnsorted', () => {
    it('should compare arrays of objects correctly', () => {
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

    it('should ignore expect.anything() fields', () => {
        const actual = [
            { id: expect.anything(), name: 'John', age: 30 },
            { id: expect.anything(), name: 'Jane', age: 25 }
        ]
        const expected = [
            { id: 1, name: 'Jane', age: 25 },
            { id: 2, name: 'John', age: 30 }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
    })

    it('should throw when arrays are not equal', () => {
        const actual = [
            { id: 1, name: 'John', age: 30 },
            { id: 2, name: 'Jane', age: 25 }
        ]
        const expected = [
            { id: 1, name: 'John', age: 31 }, // age is different
            { id: 2, name: 'Jane', age: 25 }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).toThrow()
    })

    it('should handle nested objects', () => {
        const actual = [
            { id: 1, name: 'John', address: { city: 'New York', zip: expect.anything() } },
            { id: 2, name: 'Jane', address: { city: 'Los Angeles', zip: expect.anything() } }
        ]
        const expected = [
            { id: 2, name: 'Jane', address: { city: 'Los Angeles', zip: '90001' } },
            { id: 1, name: 'John', address: { city: 'New York', zip: '10001' } }
        ]

        expect(() => expectEqualUnsorted(actual, expected)).not.toThrow()
    })

    it('should throw when actual or expected is undefined', () => {
        expect(() => expectEqualUnsorted(undefined, [])).toThrow('actual or expected undefined')
        expect(() => expectEqualUnsorted([], undefined)).toThrow('actual or expected undefined')
    })

    it('should handle empty arrays', () => {
        expect(() => expectEqualUnsorted([], [])).not.toThrow()
    })
})
