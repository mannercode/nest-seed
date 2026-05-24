import type { HydratedDocument } from 'mongoose'
import { HardDeleteSample, SoftDeleteSample, type CrudDeleteFixture } from './crud-delete.fixture'

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

        it('새 문서는 deletedAt이 null로 저장된다', async () => {
            expect(createdDoc).toMatchObject({ deletedAt: null })
        })

        it('Model.create로 만든 문서도 deletedAt이 null이다', async () => {
            const doc = await fix.model.create({ name: 'created' })
            expect(doc.deletedAt).toBeNull()
        })

        it('insertMany로 만든 문서도 deletedAt이 null이다', async () => {
            await fix.model.insertMany([{ name: 'a' }, { name: 'b' }])

            const docs = await fix.model.find({})
            expect(docs).toHaveLength(3)
            expect(docs.every((d) => d.deletedAt === null)).toBe(true)
        })

        describe('삭제 메서드는 deletedAt을 기록한다', () => {
            it('Model.deleteOne은 deletedAt을 기록한다', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })

            it('Model.deleteMany는 각 문서에 deletedAt을 기록한다', async () => {
                const secondDoc = new fix.model()
                secondDoc.name = 'name'
                await secondDoc.save()

                await fix.model.deleteMany({ _id: { $in: [createdDoc._id, secondDoc._id] } })

                const deletedDocs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(deletedDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(deletedDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })

            it('document.deleteOne()은 deletedAt을 기록한다', async () => {
                await createdDoc.deleteOne()

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })

            it('findOneAndDelete는 물리적으로 삭제하지 않고 deletedAt만 기록한다', async () => {
                await fix.model.findOneAndDelete({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('deleteOne의 반환값', () => {
            it('삭제 성공 시 deletedCount는 1이다', async () => {
                const result = await fix.model.deleteOne({ _id: createdDoc._id })
                expect(result).toMatchObject({ deletedCount: 1 })
            })

            it('일치하는 문서가 없으면 deletedCount는 0이다', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
                const result = await fix.model.deleteOne({ _id: createdDoc._id })
                expect(result).toMatchObject({ deletedCount: 0 })
            })
        })

        describe('이미 삭제된 문서 조회 시', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('find는 삭제된 문서를 제외한다', async () => {
                const docs = await fix.model.find({})
                expect(docs).toHaveLength(0)
            })

            it('findOne은 삭제된 문서를 제외한다', async () => {
                const doc = await fix.model.findOne({ _id: { $eq: createdDoc._id } })
                expect(doc).toBeNull()
            })

            it('findById는 삭제된 문서를 제외한다', async () => {
                const doc = await fix.model.findById(createdDoc._id)
                expect(doc).toBeNull()
            })

            it('countDocuments는 삭제된 문서를 제외한다', async () => {
                const count = await fix.model.countDocuments({})
                expect(count).toBe(0)
            })

            it('exists는 삭제된 문서를 제외한다', async () => {
                const result = await fix.model.exists({ _id: { $eq: createdDoc._id } })
                expect(result).toBeNull()
            })

            it('aggregate는 삭제된 문서를 제외한다', async () => {
                const aggregateResult = await fix.model.aggregate([{ $match: { name: 'name' } }])
                expect(aggregateResult).toHaveLength(0)
            })

            it('distinct는 삭제된 문서의 값을 결과에 포함하지 않는다', async () => {
                const names = await fix.model.distinct('name')
                expect(names).toEqual([])
            })

            it('withDeleted:true 옵션이면 삭제된 문서도 포함한다', async () => {
                const docs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(docs).toHaveLength(1)
            })
        })

        describe('이미 삭제된 문서에 대한 update', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('updateOne은 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.updateOne(
                    { _id: createdDoc._id },
                    { name: 'updated' }
                )
                expect(result.modifiedCount).toBe(0)
            })

            it('updateMany는 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.updateMany({}, { name: 'updated' })
                expect(result.modifiedCount).toBe(0)
            })

            it('findOneAndUpdate는 삭제된 문서를 반환하지 않는다', async () => {
                const doc = await fix.model.findOneAndUpdate(
                    { _id: createdDoc._id },
                    { name: 'updated' },
                    { returnDocument: 'after' }
                )
                expect(doc).toBeNull()
            })

            it('findOneAndReplace는 삭제된 문서를 반환하거나 대체하지 않는다', async () => {
                const doc = await fix.model.findOneAndReplace(
                    { _id: createdDoc._id },
                    { name: 'replaced' },
                    { returnDocument: 'after' }
                )
                expect(doc).toBeNull()
            })
        })

        it('이미 삭제된 문서를 다시 deleteOne해도 deletedAt은 바뀌지 않는다', async () => {
            await fix.model.deleteOne({ _id: createdDoc._id })

            const firstDoc = await fix.model
                .findOne({ _id: { $eq: createdDoc._id } })
                .setOptions({ withDeleted: true })
                .exec()
            const firstDeletedAt = firstDoc?.deletedAt

            await fix.model.deleteOne({ _id: createdDoc._id })

            const secondDoc = await fix.model
                .findOne({ _id: { $eq: createdDoc._id } })
                .setOptions({ withDeleted: true })
                .exec()

            expect(secondDoc?.deletedAt).toEqual(firstDeletedAt)
        })

        describe('복원', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('deletedAt을 null로 갱신하면 다시 조회된다', async () => {
                await fix.model
                    .updateOne({ _id: createdDoc._id }, { deletedAt: null })
                    .setOptions({ withDeleted: true })

                const doc = await fix.model.findById(createdDoc._id)
                expect(doc).not.toBeNull()
            })

            it('withDeleted로 조회한 문서의 deletedAt을 null로 두고 save해도 복원된다', async () => {
                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                if (!deletedDoc) throw new Error('deletedDoc must exist')

                deletedDoc.deletedAt = null
                await deletedDoc.save()

                const restored = await fix.model.findById(createdDoc._id)
                expect(restored).not.toBeNull()
            })
        })

        describe('bulkWrite', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('updateOne은 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.bulkWrite([
                    { updateOne: { filter: { _id: createdDoc._id }, update: { name: 'updated' } } }
                ])
                expect(result.modifiedCount).toBe(0)
            })

            it('updateMany는 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.bulkWrite([
                    { updateMany: { filter: {}, update: { name: 'updated' } } }
                ])
                expect(result.modifiedCount).toBe(0)
            })

            it('replaceOne은 삭제된 문서를 교체하지 않는다', async () => {
                const result = await fix.model.bulkWrite([
                    {
                        replaceOne: {
                            filter: { _id: createdDoc._id },
                            replacement: { name: 'replaced' } as SoftDeleteSample
                        }
                    }
                ])
                expect(result.modifiedCount).toBe(0)
            })

            it('deleteOne은 soft delete로 동작한다', async () => {
                const liveDoc = await fix.model.create({ name: 'live' })

                await fix.model.bulkWrite([{ deleteOne: { filter: { _id: liveDoc._id } } }])

                const doc = await fix.model
                    .findOne({ _id: { $eq: liveDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()
                expect(doc?.deletedAt).toEqual(expect.any(Date))
            })

            it('deleteMany는 soft delete로 동작한다', async () => {
                const liveDoc1 = await fix.model.create({ name: 'live1' })
                const liveDoc2 = await fix.model.create({ name: 'live2' })

                await fix.model.bulkWrite([
                    { deleteMany: { filter: { name: { $in: ['live1', 'live2'] } } } }
                ])

                const docs = await fix.model
                    .find({ _id: { $in: [liveDoc1._id, liveDoc2._id] } })
                    .setOptions({ withDeleted: true })
                expect(docs).toHaveLength(2)
                expect(docs.every((d) => d.deletedAt instanceof Date)).toBe(true)
            })

            it('insertOne은 변환되지 않고 그대로 삽입된다', async () => {
                // bulkWrite의 insertOne은 소프트 삭제 미들웨어 변환 대상이 아니라 정상적으로 새 문서를 추가한다.
                await fix.model.bulkWrite([{ insertOne: { document: { name: 'inserted' } } }])

                const inserted = await fix.model.findOne({ name: 'inserted' })
                expect(inserted).not.toBeNull()
                expect(inserted?.deletedAt).toBeNull()
            })
        })

        // unique 인덱스는 collection 전체(삭제 포함)에 적용되는 알려진 한계이다.
        // 회피하려면 애플리케이션이 partial index를 써야 한다.
        it('unique index는 삭제된 문서에도 여전히 적용된다', async () => {
            await fix.model.collection.createIndex({ name: 1 }, { unique: true })
            await fix.model.deleteOne({ _id: createdDoc._id })

            await expect(fix.model.create({ name: 'name' })).rejects.toThrow(/duplicate key/i)
        })

        describe('deletedAt을 명시적으로 조회하면', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('withDeleted 없이는 미들웨어가 필터를 덮어쓴다', async () => {
                const docs = await fix.model.find({ deletedAt: { $ne: null } })
                expect(docs).toHaveLength(0)
            })

            it('withDeleted:true와 함께 쓰면 명시적 필터가 그대로 적용된다', async () => {
                const docs = await fix.model
                    .find({ deletedAt: { $ne: null } })
                    .setOptions({ withDeleted: true })
                expect(docs).toHaveLength(1)
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

        it('새 문서에는 deletedAt 필드가 없다', async () => {
            expect(createdDoc).not.toHaveProperty('deletedAt')
        })

        it('deleteOne은 문서를 실제로 삭제한다', async () => {
            await fix.model.deleteOne({ _id: createdDoc._id })
            const doc = await fix.model.findById(createdDoc._id)
            expect(doc).toBeNull()
        })
    })
})
