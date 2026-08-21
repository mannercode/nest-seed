import { sleep } from '../async'

describe('sleep', () => {
    afterEach(() => {
        jest.useRealTimers()
    })

    it('주어진 시간이 지난 뒤 완료된다', async () => {
        jest.useFakeTimers()
        const completed = jest.fn()
        const sleeping = sleep(10).then(completed)

        await jest.advanceTimersByTimeAsync(9)
        expect(completed).not.toHaveBeenCalled()

        await jest.advanceTimersByTimeAsync(1)
        await sleeping
        expect(completed).toHaveBeenCalledTimes(1)
    })
})
