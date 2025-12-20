import type { HydratedDocument } from 'mongoose'
import type { MongooseDeleteFixture } from './mongoose.delete.fixture'
import { HardDeleteSample, SoftDeleteSample } from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fix: MongooseDeleteFixture<SoftDeleteSample>
        let createdDoc: HydratedDocument<SoftDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fix = await createMongooseDeleteFixture(SoftDeleteSample)

            createdDoc = new fix.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })
        afterEach(() => fix.teardown())

        describe('when creating a new document', () => {
            it('sets deletedAt to null', async () => {
                expect(createdDoc).toMatchObject({ deletedAt: null })
            })
        })

        describe('when calling deleteOne', () => {
            it('records deletedAt', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('when calling deleteMany', () => {
            it('records deletedAt for each document', async () => {
                const secondDoc = new fix.model()
                secondDoc.name = 'name'
                await secondDoc.save()

                await fix.model.deleteMany({ _id: { $in: [createdDoc._id, secondDoc._id] } as any })

                const deletedDocs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(deletedDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(deletedDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        describe('when aggregating', () => {
            it('excludes deleted documents', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })

                const aggregateResult = await fix.model.aggregate([{ $match: { name: 'name' } }])

                expect(aggregateResult).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fix: MongooseDeleteFixture<HardDeleteSample>
        let createdDoc: HydratedDocument<HardDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fix = await createMongooseDeleteFixture(HardDeleteSample)

            createdDoc = new fix.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })
        afterEach(() => fix.teardown())

        describe('when creating a new document', () => {
            it('does not have deletedAt', async () => {
                expect(createdDoc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
