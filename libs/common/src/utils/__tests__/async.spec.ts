import { sleep } from '../async'

describe('sleep', () => {
    it('주어진 시간이 지난 뒤 완료된다', async () => {
        await expect(sleep(10)).resolves.toBeUndefined()
    })
})
