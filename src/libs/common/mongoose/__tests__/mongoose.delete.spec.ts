import { HydratedDocument } from 'mongoose'
import {
    HardDeleteSample,
    MongooseDeleteFixture,
    SoftDeleteSample
} from './mongoose.delete.fixture'

describe('Mongoose Delete', () => {
    describe('Soft Delete', () => {
        let fixture: MongooseDeleteFixture<SoftDeleteSample>
        let createdDoc: HydratedDocument<SoftDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fixture = await createMongooseDeleteFixture(SoftDeleteSample)

            createdDoc = new fixture.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        describe('when creating a new document', () => {
            it('sets deletedAt to null', async () => {
                expect(createdDoc).toMatchObject({ deletedAt: null })
            })
        })

        describe('when calling deleteOne', () => {
            it('records deletedAt', async () => {
                await fixture.model.deleteOne({ _id: createdDoc._id })

                const deletedDoc = await fixture.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('when calling deleteMany', () => {
            it('records deletedAt for each document', async () => {
                const secondDoc = new fixture.model()
                secondDoc.name = 'name'
                await secondDoc.save()

                await fixture.model.deleteMany({
                    _id: { $in: [createdDoc._id, secondDoc._id] } as any
                })

                const deletedDocs = await fixture.model.find({}).setOptions({ withDeleted: true })
                expect(deletedDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(deletedDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        describe('when aggregating', () => {
            it('excludes deleted documents', async () => {
                await fixture.model.deleteOne({ _id: createdDoc._id })

                const aggregateResult = await fixture.model.aggregate([
                    { $match: { name: 'name' } }
                ])

                expect(aggregateResult).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fixture: MongooseDeleteFixture<HardDeleteSample>
        let createdDoc: HydratedDocument<HardDeleteSample>

        beforeEach(async () => {
            const { createMongooseDeleteFixture } = await import('./mongoose.delete.fixture')
            fixture = await createMongooseDeleteFixture(HardDeleteSample)

            createdDoc = new fixture.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })

        afterEach(async () => {
            await fixture?.teardown()
        })

        describe('when creating a new document', () => {
            it('does not have deletedAt', async () => {
                expect(createdDoc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
