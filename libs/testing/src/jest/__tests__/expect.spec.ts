describe('expect', () => {
    it('toBe와 toEqual로 값을 비교한다', () => {
        // toEqual은 객체나 배열의 각 프로퍼티와 요소 값을 재귀적으로 비교한다.
        // 참조가 달라도 내용이 같으면 통과한다.
        // toBe는 원시 값에서는 값과 타입을 모두 비교하고, 객체나 배열에서는 참조를 비교한다.
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

    it('객체 배열을 비교한다', () => {
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

    it('객체 배열의 부분을 비교한다', () => {
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
