import { sleep } from '../../utils'
import type { MongooseExpiresFixture } from './mongoose.expires.fixture'

describe('Mongoose TTL expiration', () => {
    let fix: MongooseExpiresFixture

    beforeEach(async () => {
        const { createMongooseExpiresFixture } = await import('./mongoose.expires.fixture')
        fix = await createMongooseExpiresFixture()
    })
    afterEach(() => fix.teardown())

    describe('when the TTL expires', () => {
        it('removes the document automatically', async () => {
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
})
