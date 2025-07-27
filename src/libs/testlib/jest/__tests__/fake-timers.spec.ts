/**
 * If you use useFakeTimers(), Mongoose(MongoDB)-related code may not work properly.
 * It may also affect other modules, so it's recommended not to use it.
 *
 * useFakeTimers()를 사용하면 Mongoose(MongoDB) 관련 코드가 제대로 동작하지 않는다.
 * 다른 모듈에도 영향을 줄 가능성이 있기 때문에 사용하지 않는 것을 권장한다.
 */

describe('jest.useFakeTimers examples', () => {
    beforeEach(async () => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    test('advanceTimersByTime', () => {
        const mockCallback = jest.fn()

        setTimeout(() => mockCallback('Real value'), 1000)
        expect(mockCallback).not.toHaveBeenCalledWith('Real value')

        jest.advanceTimersByTime(1000)
        expect(mockCallback).toHaveBeenCalledWith('Real value')
    })

    test('setSystemTime', () => {
        const mockDate = new Date('1999-02-31T14:30')

        jest.setSystemTime(mockDate)

        const currentDate = new Date()

        expect(mockDate.toISOString()).toEqual(currentDate.toISOString())
    })
})
