describe('jest examples', () => {
    it('toBe vs toEqual', () => {
        // toEqual
        // For objects or arrays, each property or element value is compared recursively.
        // Even if the references of objects or arrays are different, toEqual passes if the contents are the same.

        // toBe
        // For primitive values, both the value and the type must match.
        // For objects or arrays, the reference must be the same.

        expect('hello').toBe('hello')
        expect('hello').toEqual('hello')

        expect(true).toBe(true)
        expect(true).toEqual(true)

        const obj1 = { a: 1, b: 2 }
        const obj2 = { a: 1, b: 2 }
        expect(obj1).toEqual(obj2)
        expect(obj1).not.toBe(obj2)

        const arr1 = [1, 2, 3]
        const arr2 = [1, 2, 3]
        expect(arr1).toEqual(arr2)
        expect(arr1).not.toBe(arr2)
    })

    test('Comparing arrays of objects', () => {
        const array1 = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' }
        ]
        const array2 = [
            { id: 2, name: 'B' },
            { id: 1, name: 'A' }
        ]

        expect(array1).toEqual(expect.arrayContaining(array2))
    })

    test('Comparing partial objects', () => {
        const array1 = [
            { id: 1, name: 'A', extra: 'info' },
            { id: 2, name: 'B', extra: 'data' }
        ]
        const array2 = [
            { id: 2, name: 'B' },
            { id: 1, name: 'A' }
        ]

        expect(array1).toEqual(
            expect.arrayContaining(array2.map((obj) => expect.objectContaining(obj)))
        )
    })
})
