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

        describe('새 문서를 생성할 때', () => {
            it('deletedAt을 null로 설정한다', async () => {
                expect(createdDoc).toMatchObject({ deletedAt: null })
            })
        })

        describe('모델 수준 deleteOne을 호출할 때', () => {
            it('deletedAt을 기록한다', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('모델 수준 deleteMany를 호출할 때', () => {
            let secondDoc: HydratedDocument<SoftDeleteSample>

            beforeEach(async () => {
                secondDoc = new fix.model()
                secondDoc.name = 'name'
                await secondDoc.save()
            })

            it('각 문서에 deletedAt을 기록한다', async () => {
                await fix.model.deleteMany({ _id: { $in: [createdDoc._id, secondDoc._id] } })

                const deletedDocs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(deletedDocs[0]).toMatchObject({ deletedAt: expect.any(Date) })
                expect(deletedDocs[1]).toMatchObject({ deletedAt: expect.any(Date) })
            })
        })

        describe('문서 수준 deleteOne을 호출할 때', () => {
            it('deletedAt을 기록한다', async () => {
                await createdDoc.deleteOne()

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('삭제된 문서가 있을 때의 조회 동작', () => {
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

            it('집계는 삭제된 문서를 제외한다', async () => {
                const aggregateResult = await fix.model.aggregate([{ $match: { name: 'name' } }])
                expect(aggregateResult).toHaveLength(0)
            })

            it('withDeleted:true는 삭제된 문서를 포함한다', async () => {
                const docs = await fix.model.find({}).setOptions({ withDeleted: true })
                expect(docs).toHaveLength(1)
            })
        })

        describe('삭제된 문서를 대상으로 한 update 동작', () => {
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
        })

        describe('복원 동작', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('deletedAt을 null로 복원하면 다시 조회 가능하다', async () => {
                await fix.model
                    .updateOne({ _id: createdDoc._id }, { deletedAt: null })
                    .setOptions({ withDeleted: true })

                const doc = await fix.model.findById(createdDoc._id)
                expect(doc).not.toBeNull()
            })
        })

        describe('deleteOne 카운트 반환', () => {
            it('삭제된 문서 수를 반환한다', async () => {
                const result = await fix.model.deleteOne({ _id: createdDoc._id })
                expect(result).toMatchObject({ deletedCount: 1 })
            })

            it('일치하는 문서가 없으면 0을 반환한다', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
                const result = await fix.model.deleteOne({ _id: createdDoc._id })
                expect(result).toMatchObject({ deletedCount: 0 })
            })
        })

        describe('findOneAndDelete', () => {
            it('deletedAt만 기록하고 물리적으로 삭제하지 않는다', async () => {
                await fix.model.findOneAndDelete({ _id: createdDoc._id })

                const deletedDoc = await fix.model
                    .findOne({ _id: { $eq: createdDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()

                expect(deletedDoc?.deletedAt).toEqual(expect.any(Date))
            })
        })

        describe('distinct 동작', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('삭제된 문서의 값은 결과에 포함되지 않는다', async () => {
                const names = await fix.model.distinct('name')
                expect(names).toEqual([])
            })
        })

        describe('이미 삭제된 문서에 대한 중복 삭제', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('deletedAt이 재설정되지 않는다 (idempotency)', async () => {
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
        })

        describe('insertMany', () => {
            it('각 새 문서의 deletedAt이 null이다', async () => {
                await fix.model.insertMany([{ name: 'a' }, { name: 'b' }])

                const docs = await fix.model.find({})
                expect(docs).toHaveLength(3) // createdDoc + 2 new
                expect(docs.every((d) => d.deletedAt === null)).toBe(true)
            })
        })

        describe('bulkWrite 동작', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('updateOne in bulkWrite는 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.bulkWrite([
                    { updateOne: { filter: { _id: createdDoc._id }, update: { name: 'updated' } } }
                ])
                expect(result.modifiedCount).toBe(0)
            })

            it('updateMany in bulkWrite는 삭제된 문서를 수정하지 않는다', async () => {
                const result = await fix.model.bulkWrite([
                    { updateMany: { filter: {}, update: { name: 'updated' } } }
                ])
                expect(result.modifiedCount).toBe(0)
            })

            it('replaceOne in bulkWrite는 삭제된 문서를 교체하지 않는다', async () => {
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

            it('deleteOne in bulkWrite는 softDelete로 동작한다', async () => {
                // 새 문서 생성 (createdDoc는 이미 삭제됨)
                const liveDoc = await fix.model.create({ name: 'live' })

                await fix.model.bulkWrite([{ deleteOne: { filter: { _id: liveDoc._id } } }])

                const doc = await fix.model
                    .findOne({ _id: { $eq: liveDoc._id } })
                    .setOptions({ withDeleted: true })
                    .exec()
                expect(doc?.deletedAt).toEqual(expect.any(Date))
            })

            it('deleteMany in bulkWrite는 softDelete로 동작한다', async () => {
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
        })

        describe('findOneAndReplace on soft-deleted documents', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('삭제된 문서를 반환하거나 대체하지 않는다', async () => {
                const doc = await fix.model.findOneAndReplace(
                    { _id: createdDoc._id },
                    { name: 'replaced' },
                    { returnDocument: 'after' }
                )
                expect(doc).toBeNull()
            })
        })

        describe('Model.create with soft delete', () => {
            it('create로 생성된 문서도 deletedAt이 null이다', async () => {
                const doc = await fix.model.create({ name: 'created' })
                expect(doc.deletedAt).toBeNull()
            })
        })

        describe('save on document loaded with withDeleted', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('deletedAt을 null로 설정하고 save하면 복원된다', async () => {
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

        describe('unique index interaction with soft delete', () => {
            // 삭제된 문서와 같은 unique 값으로 새 문서 생성이 가능한가?
            // 현재: unique index는 collection 전체(삭제 포함)에 적용되므로 실패한다
            // 이건 documented limitation. 애플리케이션이 필요시 partial index를 써야 함.
            it('unique index 는 soft-deleted 문서에도 여전히 적용된다 (documented limitation)', async () => {
                await fix.model.collection.createIndex({ name: 1 }, { unique: true })
                await fix.model.deleteOne({ _id: createdDoc._id })

                // 같은 name 으로 create 시도 → unique 위반 에러
                await expect(fix.model.create({ name: 'name' })).rejects.toThrow(/duplicate key/i)
            })
        })

        describe('explicit deletedAt query', () => {
            beforeEach(async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
            })

            it('withDeleted 없이 명시적으로 deletedAt 조회해도 middleware가 덮어쓴다', async () => {
                // deletedAt !== null 로 찾으려 해도 middleware가 덮어씀
                const docs = await fix.model.find({ deletedAt: { $ne: null } })
                expect(docs).toHaveLength(0)
            })

            it('withDeleted:true + 명시적 deletedAt 필터는 그대로 동작한다', async () => {
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

        describe('새 문서를 생성할 때', () => {
            it('deletedAt이 존재하지 않는다', async () => {
                expect(createdDoc).not.toHaveProperty('deletedAt')
            })
        })

        describe('deleteOne은 문서를 실제로 삭제한다', () => {
            it('문서가 DB에서 제거된다', async () => {
                await fix.model.deleteOne({ _id: createdDoc._id })
                const doc = await fix.model.findById(createdDoc._id)
                expect(doc).toBeNull()
            })
        })
    })
})
