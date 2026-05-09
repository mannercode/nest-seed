import { sleep } from '../async'

describe('sleep', () => {
    it('주어진 timeout 후에 resolve되는 promise를 반환한다', async () => {
        await expect(sleep(10)).resolves.toBeUndefined()
    })
})
