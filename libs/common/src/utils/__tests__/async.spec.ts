import { sleep } from '../async'

describe('sleep', () => {
    it('주어진 시간이 지난 뒤 완료된다', async () => {
        const start = Date.now()

        await expect(sleep(10)).resolves.toBeUndefined()

        // setTimeout은 타이머 해상도 탓에 1ms 미만 이르게 깨어날 수 있어 하한을 1ms 낮춘다.
        expect(Date.now() - start).toBeGreaterThanOrEqual(9)
    })
})
