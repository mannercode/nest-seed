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
        const mockDate = new Date('1999-02-31T14:30')

        jest.setSystemTime(mockDate)

        const currentDate = new Date()

        expect(mockDate.toISOString()).toEqual(currentDate.toISOString())
    })
})
