import { sleep } from '../index.js'

describe('sleep', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('주어진 시간이 지난 뒤 완료된다', async () => {
        vi.useFakeTimers()
        const completed = vi.fn()
        const sleeping = sleep(10).then(completed)

        await vi.advanceTimersByTimeAsync(9)
        expect(completed).not.toHaveBeenCalled()

        await vi.advanceTimersByTimeAsync(1)
        await sleeping
        expect(completed).toHaveBeenCalledTimes(1)
    })
})
