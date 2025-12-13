import {
    HardDeleteSample,
    MongooseDeleteFixture,
    SoftDeleteSample
} from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fix: MongooseDeleteFixture<SoftDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fix = await createMongooseDeleteFixture(SoftDeleteSample)
        })

        afterEach(async () => {
            await fix?.teardown()
        })

        describe('when the document is newly created', () => {
            // TODO fix
            // deletedAt이 null이다
            it('sets deletedAt to null', async () => {
                expect(fix.doc).toMatchObject({ deletedAt: null })
            })
        })

        it('records deletedAt for deleteOne calls', async () => {
            await fix.model.deleteOne({ _id: fix.doc._id })

            const foundDoc = await fix.model
                .findOne({ _id: { $eq: fix.doc._id } })
                .setOptions({ withDeleted: true })
                .exec()

            expect(foundDoc?.deletedAt).toEqual(expect.any(Date))
        })

        it('records deletedAt for each document on deleteMany', async () => {
            const doc2 = new fix.model()
            doc2.name = 'name'
            await doc2.save()

            await fix.model.deleteMany({ _id: { $in: [fix.doc._id, doc2._id] } as any })

            const foundDocs = await fix.model.find({}).setOptions({ withDeleted: true })
            expect(foundDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
            expect(foundDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
        })

        it('excludes deleted documents from aggregates', async () => {
            await fix.model.deleteOne({ _id: fix.doc._id })

            const got = await fix.model.aggregate([{ $match: { name: 'name' } }])

            expect(got).toHaveLength(0)
        })
    })

    describe('Hard Delete', () => {
        let fix: MongooseDeleteFixture<HardDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fix = await createMongooseDeleteFixture(HardDeleteSample)
        })

        afterEach(async () => {
            await fix?.teardown()
        })

        it('removes the document entirely', async () => {
            expect(fix.doc).not.toHaveProperty('deletedAt')
        })
    })
})
