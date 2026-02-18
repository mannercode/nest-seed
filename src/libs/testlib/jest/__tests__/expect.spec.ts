describe('jest.expect examples', () => {
    // toBe와 toEqual로 값을 비교한다
    it('compares values with toBe vs toEqual', () => {
        /**
         * toEqual
         *   For objects or arrays, each property or element is compared recursively.
         *   Even if the references of objects or arrays differ, toEqual will pass if their contents are the same.
         *   객체나 배열의 경우, 각 프로퍼티나 요소의 값이 재귀적으로 비교됩니다.
         *   객체나 배열의 참조가 다르더라도, 내용이 같으면 toEqual은 통과합니다.
         * toBe
         *   For primitive values, both the value and type must match.
         *   For objects or arrays, their references must be the same.
         *   원시 값의 경우, 값과 타입 모두 일치해야 합니다.
         *   객체나 배열의 경우, 참조가 동일해야 합니다.
         */
        expect('hello').toBe('hello')
        expect('hello').toEqual('hello')

        expect(true).toBe(true)
        expect(true).toEqual(true)

        const firstObject = { a: 1, b: 2 }
        const secondObject = { a: 1, b: 2 }
        expect(firstObject).toEqual(secondObject)
        expect(firstObject).not.toBe(secondObject)

        const firstArray = [1, 2, 3]
        const secondArray = [1, 2, 3]
        expect(firstArray).toEqual(secondArray)
        expect(firstArray).not.toBe(secondArray)
    })

    // 객체 배열을 비교한다
    it('compares an array of objects', () => {
        const actualObjects = [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' }
        ]
        const expectedObjects = [
            { id: 2, name: 'B' },
            { id: 1, name: 'A' }
        ]

        expect(actualObjects).toEqual(expect.arrayContaining(expectedObjects))
    })

    // 객체 배열의 부분을 비교한다
    it('compares a partial array of objects', () => {
        const fullObjects = [
            { extra: 'info', id: 1, name: 'A' },
            { extra: 'data', id: 2, name: 'B' }
        ]
        const partialObjects = [
            { id: 2, name: 'B' },
            { id: 1, name: 'A' }
        ]

        expect(fullObjects).toEqual(
            expect.arrayContaining(
                partialObjects.map((partial) => expect.objectContaining(partial))
            )
        )
    })
})
