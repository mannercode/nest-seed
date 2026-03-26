import type { MongooseExpiresFixture } from './mongoose-expires.fixture'
import { sleep } from '../../utils'

describe('Mongoose TTL expiration', () => {
    let fix: MongooseExpiresFixture

    beforeEach(async () => {
        const { createMongooseExpiresFixture } = await import('./mongoose-expires.fixture')
        fix = await createMongooseExpiresFixture()
    })
    afterEach(() => fix.teardown())

    // TTL이 만료되었을 때
    describe('when the TTL expires', () => {
        let docId: any
        let sn: number

        beforeEach(async () => {
            const doc = new fix.model()
            sn = 1234567
            doc.sn = sn

            await doc.save()
            docId = doc._id
        })

        // 문서를 자동으로 삭제한다
        it('removes the document automatically', async () => {
            const initialDoc = await fix.model.findOne({ _id: docId }).exec()
            expect(initialDoc?.sn).toEqual(sn)

            await sleep(2000)
            const expiredDoc = await fix.model.findOne({ _id: docId }).exec()
            expect(expiredDoc).toBeNull()
        })
    })
})
