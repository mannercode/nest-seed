describe('jest examples', () => {
    it('toBe vs toEqual', () => {
        // toEqual
        // 객체나 배열의 경우, 각 프로퍼티나 요소의 값이 재귀적으로 비교됩니다.
        // 객체나 배열의 참조가 다르더라도, 내용이 같으면 toEqual은 통과합니다.

        // toBe
        // 원시 값의 경우, 값과 타입 모두 일치해야 합니다.
        // 객체나 배열의 경우, 참조가 동일해야 합니다.

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

    test('객체 배열 비교', () => {
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

    test('부분 객체 배열 비교', () => {
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
