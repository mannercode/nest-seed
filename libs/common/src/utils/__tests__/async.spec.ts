import { sleep } from '../async'

describe('sleep', () => {
    it('지정된 시간만큼 대기한다', async () => {
        const start = Date.now()
        const timeout = 1000

        await sleep(timeout)

        const end = Date.now()
        const elapsed = end - start

        const tolerance = 500
        expect(elapsed).toBeGreaterThan(timeout - tolerance)
        expect(elapsed).toBeLessThan(timeout + tolerance)
    })
})
