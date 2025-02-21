/**
 * 가능한 경우 사용하지 마세요. useFakeTimers()는 예기치 않은 문제가 많습니다.
 * 특히 Mongoose(MongoDB) 관련 코드가 제대로 동작하지 않을 수 있습니다.
 */

describe('Timer functions', () => {
    beforeEach(async () => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    test('타이머 함수가 올바르게 모킹되는지 확인', () => {
        const mockCallback = jest.fn()

        setTimeout(() => mockCallback('Real value'), 1000)
        expect(mockCallback).not.toHaveBeenCalledWith('Real value')

        jest.advanceTimersByTime(1000)
        expect(mockCallback).toHaveBeenCalledWith('Real value')
    })

    it('시스템 시간을 특정 날짜로 모킹하는지 확인', () => {
        const mockDate = new Date('1999-02-31T14:30')

        jest.setSystemTime(mockDate)

        const currentDate = new Date()

        expect(mockDate.toISOString()).toEqual(currentDate.toISOString())
    })
})
