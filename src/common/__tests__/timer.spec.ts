/**
 * AVOID USING IT IF POSSIBLE. useFakeTimers() CAUSES A LOT OF UNEXPECTED PROBLEMS.
 */

describe('Timer', () => {
    beforeEach(async () => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.clearAllMocks()
        jest.useRealTimers()
    })

    test('Check if the timer function is properly mocked', () => {
        const mockCallback = jest.fn()

        setTimeout(() => mockCallback('Real value'), 1000)

        expect(mockCallback).not.toHaveBeenCalledWith('Real value')

        jest.advanceTimersByTime(1000)

        expect(mockCallback).toHaveBeenCalledWith('Real value')
    })

    it('should mock system time to a specific date', () => {
        const mockDate = new Date('1999-02-31T14:30')
        jest.setSystemTime(mockDate)

        const currentDate = new Date()

        expect(mockDate.toISOString()).toEqual(currentDate.toISOString())
    })
})
