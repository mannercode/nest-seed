import { sleep } from '../../utils'
import type { Fixture } from './mongoose.expires.fixture'

describe('Mongoose Expires Examples', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.expires.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    it('removes the document automatically after the TTL expires', async () => {
        const doc = new fixture.model()
        doc.sn = 1234567

        await doc.save()

        const initialDoc = await fixture.model.findOne({ _id: doc._id }).exec()
        expect(initialDoc?.sn).toEqual(doc.sn)

        await sleep(2000)
        const expiredDoc = await fixture.model.findOne({ _id: doc._id }).exec()
        expect(expiredDoc).toBeNull()
    })
})
