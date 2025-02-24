import { expect } from '@jest/globals'
import { HydratedDocument, Model } from 'mongoose'
import { CloseFixture } from 'testlib'
import { SchemaSample } from './mongoose.schema.fixture'

describe('Soft Delete', () => {
    let closeFixture: CloseFixture
    let model: Model<any>

    beforeEach(async () => {
        const { createFixture } = await import('./mongoose.schema.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        model = fixture.model
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('deleteOne으로 삭제하면 삭제된 시간이 deletedAt에 기록되어야 한다', async () => {
        const doc = new model()
        doc.name = 'name'
        await doc.save()

        await model.deleteOne({ _id: doc._id })

        const found = await model
            .findOne({ _id: { $eq: doc._id } })
            .setOptions({ withDeleted: true })
            .exec()

        expect(found.deletedAt).toEqual(expect.any(Date))
    })
})
