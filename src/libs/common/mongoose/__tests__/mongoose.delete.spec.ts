import {
    HardDeleteSample,
    MongooseDeleteFixture,
    SoftDeleteSample
} from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fixture: MongooseDeleteFixture<SoftDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fixture = await createMongooseDeleteFixture(SoftDeleteSample)
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        describe('when the document is newly created', () => {
            // TODO fix
            // deletedAt이 null이다
            it('sets deletedAt to null', async () => {
                expect(fixture.doc).toMatchObject({ deletedAt: null })
            })
        })

        describe('when deleting with deleteOne', () => {
            it('records deletedAt with the deletion time', async () => {
                await fixture.model.deleteOne({ _id: fixture.doc._id })

                const foundDoc = await fixture.model
                    .findOne({ _id: { $eq: fixture.doc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(foundDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('when deleting with deleteMany', () => {
            it('records deletedAt for each document', async () => {
                const doc2 = new fixture.model()
                doc2.name = 'name'
                await doc2.save()

                await fixture.model.deleteMany({ _id: { $in: [fixture.doc._id, doc2._id] } as any })

                const foundDocs = await fixture.model.find({}).setOptions({ withDeleted: true })
                expect(foundDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(foundDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        describe('when aggregating after a deletion', () => {
            it('excludes deleted documents from aggregate', async () => {
                await fixture.model.deleteOne({ _id: fixture.doc._id })

                const got = await fixture.model.aggregate([{ $match: { name: 'name' } }])

                expect(got).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fixture: MongooseDeleteFixture<HardDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fixture = await createMongooseDeleteFixture(HardDeleteSample)
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        describe('when deleting a document', () => {
            it('removes the document entirely', async () => {
                expect(fixture.doc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
