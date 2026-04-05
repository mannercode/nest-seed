describe('jest.useFakeTimers examples', () => {
    beforeEach(async () => {
        jest.useFakeTimers()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    it('advanceTimersByTime', () => {
        const mockCallback = jest.fn()

        setTimeout(() => mockCallback('Real value'), 1000)
        expect(mockCallback).not.toHaveBeenCalledWith('Real value')

        jest.advanceTimersByTime(1000)
        expect(mockCallback).toHaveBeenCalledWith('Real value')
    })

    it('setSystemTime', () => {
        const mockTime = new Date('1999-02-28T14:30').getTime()

        jest.setSystemTime(mockTime)

        const currentDate = new Date()

        expect(currentDate.getTime()).toEqual(mockTime)
    })
})
