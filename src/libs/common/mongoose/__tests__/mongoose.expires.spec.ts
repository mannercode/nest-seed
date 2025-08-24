import { sleep } from '../../utils'
import type { Fixture } from './mongoose.expires.fixture'

describe('Mongoose Expires Examples', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.expires.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    // Mongoose의 TTL(Expire) 기능이 제대로 동작하는지 검증
    it('should remove document automatically after TTL expires', async () => {
        const doc = new fix.model()
        doc.sn = 1234567

        await doc.save()

        const initialDoc = await fix.model.findOne({ _id: doc._id }).exec()
        expect(initialDoc?.sn).toEqual(doc.sn)

        await sleep(2000)
        const expiredDoc = await fix.model.findOne({ _id: doc._id }).exec()
        expect(expiredDoc).toBeNull()
    })
})
