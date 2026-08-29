describe('vi.useFakeTimers', () => {
    beforeEach(async () => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('advanceTimersByTime으로 setTimeout을 즉시 실행시킨다', () => {
        const mockCallback = vi.fn()

        setTimeout(() => mockCallback('Real value'), 1000)
        expect(mockCallback).not.toHaveBeenCalledWith('Real value')

        vi.advanceTimersByTime(1000)
        expect(mockCallback).toHaveBeenCalledWith('Real value')
    })

    it('setSystemTime으로 현재 시각을 고정한다', () => {
        const mockTime = new Date('1999-02-28T14:30').getTime()

        vi.setSystemTime(mockTime)

        const currentDate = new Date()

        expect(currentDate.getTime()).toEqual(mockTime)
    })
})
