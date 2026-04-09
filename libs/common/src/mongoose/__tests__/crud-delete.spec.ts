import type { HydratedDocument } from 'mongoose'
import { HardDeleteSample, SoftDeleteSample, CrudDeleteFixture } from './crud-delete.fixture'

describe('Crud Delete', () => {
    describe('Soft Delete', () => {
        let fix: CrudDeleteFixture<SoftDeleteSample>
        let createdDoc: HydratedDocument<SoftDeleteSample>

        beforeEach(async () => {
            const { createCrudDeleteFixture } = await import('./crud-delete.fixture')
            fix = await createCrudDeleteFixture(SoftDeleteSample)

            createdDoc = new fix.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })
        afterEach(() => fix.teardown())

        // 새 문서를 생성할 때
        describe('when creating a new document', () => {
            // deletedAt을 null로 설정한다
            it('sets deletedAt to null', async () => {
                expect(createdDoc).toMatchObject({ deletedAt: null })
            })
        })

        // deleteOne을 호출할 때
        describe('when calling deleteOne', () => {
            // deletedAt을 기록한다
            it('records deletedAt', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        // deleteMany를 호출할 때
        describe('when calling deleteMany', () => {
            let secondDoc: HydratedDocument<SoftDeleteSample>

            beforeEach(async () => {
                secondDoc = new fix.model()
                secondDoc.name = 'name'
                await secondDoc.save()
            })

            // 각 문서에 deletedAt을 기록한다
            it('records deletedAt for each document', async () => {
                await fix.model.deleteMany({ _id: { $in: [createdDoc._id, secondDoc._id] } as any })

                const deletedDocs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(deletedDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(deletedDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        // 집계할 때
        describe('when aggregating', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            // 삭제된 문서를 제외한다
            it('excludes deleted documents', async () => {
                const aggregateResult = await fix.model.aggregate([{ $match: { name: 'name' } }])

                expect(aggregateResult).toHaveLength(0)
            })
        })
    })

    describe('Hard Delete', () => {
        let fix: CrudDeleteFixture<HardDeleteSample>
        let createdDoc: HydratedDocument<HardDeleteSample>

        beforeEach(async () => {
            const { createCrudDeleteFixture } = await import('./crud-delete.fixture')
            fix = await createCrudDeleteFixture(HardDeleteSample)

            createdDoc = new fix.model()
            createdDoc.name = 'name'
            await createdDoc.save()
        })
        afterEach(() => fix.teardown())

        // 새 문서를 생성할 때
        describe('when creating a new document', () => {
            // deletedAt이 존재하지 않는다
            it('does not have deletedAt', async () => {
                expect(createdDoc).not.toHaveProperty('deletedAt')
            })
        })
    })
})
