import type { MongooseExpiresFixture } from './mongoose-expires.fixture'
import { sleep } from '../../utils'

describe('Mongoose TTL', () => {
    let fix: MongooseExpiresFixture

    beforeEach(async () => {
        const { createMongooseExpiresFixture } = await import('./mongoose-expires.fixture')
        fix = await createMongooseExpiresFixture()
    })
    afterEach(() => fix.teardown())

    it('TTL이 지나면 문서가 자동으로 삭제된다', async () => {
        const doc = new fix.model()
        const sn = 1234567
        doc.sn = sn
        await doc.save()

        const initialDoc = await fix.model.findOne({ _id: doc._id }).exec()
        expect(initialDoc?.sn).toEqual(sn)

        await sleep(2000)
        const expiredDoc = await fix.model.findOne({ _id: doc._id }).exec()
        expect(expiredDoc).toBeNull()
    })
})
