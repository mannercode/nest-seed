import { sleep } from '../async'

describe('sleep', () => {
    it('주어진 시간 후에 resolve된다', async () => {
        await expect(sleep(10)).resolves.toBeUndefined()
    })
})
