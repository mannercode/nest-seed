import type { Collection, Db, IndexDescription, MongoClient } from 'mongodb'
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common'
import type { TransactionContext } from '../../index.js'
import { OrderDirection } from '../../pagination/index.js'
import { z } from 'zod'
import { InstantFromInputSchema, JsonUtil, paginationResultSchema } from '../../index.js'
import {
    CrudRepository,
    MongoConnection,
    MongoErrors,
    newObjectIdString,
    objectId
} from '../index.js'
import {
    createMongoRepositoryFixture,
    type Sample,
    type MongoRepositoryFixture
} from './crud.repository.fixture.js'

describe('CrudRepository', () => {
    let fix: MongoRepositoryFixture

    beforeEach(async () => {
        fix = await createMongoRepositoryFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('문서 연산', () => {
        it('명시적인 ID 조건으로 조회·수정하고 문서에는 id만 반환한다', async () => {
            const created = await fix.soft.create('sample')
            const filter = fix.soft.idFilter(created.id)
            const found = await fix.soft.findDocument(filter)
            expect(found).toMatchObject({ id: created.id, name: 'sample' })
            expect(found).not.toHaveProperty('_id')
            expect(filter).toEqual({ _id: objectId(created.id) })
            expect(await fix.soft.findDocument({ _id: created.id })).toBeNull()

            expect(
                await fix.soft.findDocuments(
                    { $or: [fix.soft.idsFilter([created.id])] },
                    { projection: { _id: 1 } }
                )
            ).toEqual([{ id: created.id }])
            const updated = await fix.soft.findAndUpdateDocument(
                filter,
                { $set: { name: 'updated' } },
                { returnDocument: 'after' }
            )
            expect(updated).toMatchObject({ id: created.id, name: 'updated' })
            expect(updated).not.toHaveProperty('_id')
            const page = await fix.soft.findWithPagination({ filter, pagination: {} })
            expect(page.total).toBe(1)
            expect(page.items).toEqual([updated])
            expect(await fix.soft.get({ id: created.id })).toEqual(updated)
            expect(await fix.soft.getMany({ ids: [created.id] })).toEqual([updated])
            expect(await fix.soft.countDocuments(filter)).toBe(1)
            expect(await fix.soft.distinctValues<string>('_id', filter)).toEqual([created.id])
        })

        it.each(['updateDocument', 'updateDocuments'] as const)(
            '%s의 upsert는 BSON ID로 저장하고 결과에는 문자열 ID를 반환한다',
            async (method) => {
                const id = newObjectIdString()
                const update = { $setOnInsert: fix.soft.idFilter(id), $set: { name: 'upserted' } }
                const inserted = await fix.soft[method]({ name: 'upserted' }, update, {
                    upsert: true
                })
                expect(inserted).toMatchObject({ upsertedCount: 1, upsertedId: id })
                expect(update.$setOnInsert._id).toEqual(objectId(id))
                expect(await fix.soft.collection.findOne({ _id: objectId(id) })).toMatchObject({
                    _id: objectId(id),
                    name: 'upserted'
                })
                expect(
                    await fix.soft[method](fix.soft.idFilter(id), { $set: { name: 'updated' } })
                ).toMatchObject({ matchedCount: 1, modifiedCount: 1, upsertedId: null })
                expect(await fix.soft.findDocument(fix.soft.idFilter(id))).toEqual({
                    id,
                    name: 'updated'
                })
            }
        )

        it('집계에서 문서 ID 조회와 그룹 키 조건을 구분하고 ObjectId 결과를 문자열로 반환한다', async () => {
            const created = await fix.soft.create('sample')
            expect(
                await fix.soft.aggregateDocuments([
                    { $match: fix.soft.idFilter(created.id) },
                    { $group: { _id: '$_id', count: { $sum: 1 } } }
                ])
            ).toEqual([{ _id: created.id, count: 1 }])
            expect(
                await fix.soft.aggregateDocuments([
                    { $group: { _id: '$name', count: { $sum: 1 } } },
                    { $match: { _id: 'sample' } }
                ])
            ).toEqual([{ _id: 'sample', count: 1 }])
        })

        it('조회 옵션으로 정렬·개수·필드를 제한한다', async () => {
            await fix.soft.createMany(['a', 'b', 'c'])
            expect(await fix.soft.findDocument({ name: 'a' })).toMatchObject({ name: 'a' })
            expect(
                await fix.soft.findDocument({ name: 'a' }, { projection: { _id: 0, name: 1 } })
            ).toEqual({ name: 'a' })
            expect(await fix.soft.findDocuments({})).toHaveLength(3)
            expect(
                await fix.soft.findDocuments(
                    {},
                    { sort: { name: -1 }, limit: 2, projection: { _id: 0, name: 1 } }
                )
            ).toEqual([{ name: 'c' }, { name: 'b' }])
        })

        it('수정 결과와 수정 전후 문서를 반환한다', async () => {
            await fix.soft.createMany(['a', 'b'])
            expect(
                await fix.soft.findAndUpdateDocument({ name: 'a' }, { $set: { name: 'old' } })
            ).toMatchObject({ name: 'a' })
            expect(
                await fix.soft.findAndUpdateDocument(
                    { name: 'old' },
                    { $set: { name: 'new' } },
                    { returnDocument: 'after', projection: { _id: 0, name: 1 } }
                )
            ).toEqual({ name: 'new' })
            expect(
                await fix.soft.updateDocument({ name: 'b' }, { $set: { name: 'updated' } })
            ).toMatchObject({ modifiedCount: 1 })
            expect(
                await fix.soft.updateDocuments({}, { $set: { secret: 'shared' } })
            ).toMatchObject({ modifiedCount: 2 })
        })

        it('여러 문서 수정과 조회가 같은 트랜잭션에 참여해 함께 롤백된다', async () => {
            await fix.soft.createMany(['a', 'b'])
            await expect(
                fix.soft.withTransaction(async (transaction) => {
                    const signal = new AbortController().signal
                    await fix.soft.updateDocument(
                        { name: 'a' },
                        { $set: { name: 'changed' } },
                        { transaction, signal }
                    )
                    await fix.soft.updateDocuments(
                        {},
                        { $set: { secret: 'inside' } },
                        { transaction, signal }
                    )
                    expect(
                        await fix.soft.findDocuments({ secret: 'inside' }, { transaction, signal })
                    ).toHaveLength(2)
                    expect(
                        await fix.soft.findDocument({ name: 'changed' }, { transaction, signal })
                    ).toMatchObject({ secret: 'inside' })
                    expect(
                        await fix.soft.findAndUpdateDocument(
                            { name: 'b' },
                            { $set: { name: 'inside' } },
                            { transaction, signal, returnDocument: 'after' }
                        )
                    ).toMatchObject({ name: 'inside' })
                    throw new Error('rollback')
                })
            ).rejects.toThrow('rollback')
            expect(
                await fix.soft.findDocuments(
                    {},
                    { projection: { _id: 0, name: 1, secret: 1 }, sort: { name: 1 } }
                )
            ).toEqual([{ name: 'a' }, { name: 'b' }])
        })

        it('조건에 맞는 개수·고유 값·집계를 반환한다', async () => {
            await fix.soft.createMany(['a', 'a', 'b'])
            expect(await fix.soft.countDocuments({ name: 'a' })).toBe(2)
            expect(await fix.soft.distinctValues<string>('name', {})).toEqual(['a', 'b'])
            expect(
                await fix.soft.aggregateDocuments([
                    { $group: { _id: '$name', count: { $sum: 1 } } },
                    { $sort: { _id: 1 } }
                ])
            ).toEqual([
                { _id: 'a', count: 2 },
                { _id: 'b', count: 1 }
            ])
        })
    })

    describe('onModuleInit', () => {
        let sequence = 0

        const harness = (options: { hardDelete?: boolean; indexes?: IndexDescription[] } = {}) => {
            const createIndexes = vi.fn(async () => [] as string[])
            const collection = {
                createIndexes,
                namespace: `test.initialization${sequence++}`
            } as unknown as Collection
            const client = {} as MongoClient
            const repository = new RepositoryHarness(collection, client, options)
            return { createIndexes, repository }
        }

        it('soft delete 인덱스와 명시한 인덱스를 한 번 생성한다', async () => {
            const nameIndex: IndexDescription = { key: { name: 1 }, name: 'name_lookup' }
            const { createIndexes, repository } = harness({ indexes: [nameIndex] })

            await repository.onModuleInit()

            expect(createIndexes).toHaveBeenCalledWith([{ key: { deletedAt: 1 } }, nameIndex])
        })

        it('같은 client와 namespace의 동시 초기화를 재사용한다', async () => {
            const createIndexes = vi.fn(async () => [] as string[])
            const client = {} as MongoClient
            const namespace = `test.memoized${sequence++}`
            const first = new RepositoryHarness(
                { createIndexes, namespace } as unknown as Collection,
                client
            )
            const second = new RepositoryHarness(
                { createIndexes, namespace } as unknown as Collection,
                client
            )

            await Promise.all([first.onModuleInit(), second.onModuleInit()])

            expect(createIndexes).toHaveBeenCalledTimes(1)
        })

        it('초기화 실패는 캐시에서 제거해 다음 호출이 재시도한다', async () => {
            const { createIndexes, repository } = harness()
            createIndexes.mockRejectedValueOnce(new Error('index unavailable'))

            await expect(repository.onModuleInit()).rejects.toThrow('index unavailable')
            await expect(repository.onModuleInit()).resolves.toBeUndefined()

            expect(createIndexes).toHaveBeenCalledTimes(2)
        })

        it('인덱스가 없는 hard-delete 저장소는 생성 호출을 하지 않는다', async () => {
            const { createIndexes, repository } = harness({ hardDelete: true })

            await repository.onModuleInit()

            expect(createIndexes).not.toHaveBeenCalled()
        })

        it('hard-delete 저장소도 명시한 인덱스는 생성한다', async () => {
            const sagaIndex: IndexDescription = { key: { sagaId: 1 }, unique: true }
            const { createIndexes, repository } = harness({
                hardDelete: true,
                indexes: [sagaIndex]
            })

            await repository.onModuleInit()

            expect(createIndexes).toHaveBeenCalledWith([sagaIndex])
        })

        it('실제 초기화에서 빠진 인덱스를 만들었다', async () => {
            const indexes = await fix.soft.collection.listIndexes().toArray()
            const names = indexes.map(({ name }) => name)

            expect(names).toEqual(expect.arrayContaining(['_id_', 'deletedAt_1', 'name_lookup']))
        })
    })

    describe('insertOne, insertMany, toDomainDocument', () => {
        it('기본 필드를 채우고 public id는 저장하지 않는다', async () => {
            const controller = new AbortController()
            const insertOne = vi.spyOn(fix.soft.collection, 'insertOne')
            const created = await fix.soft.create('sample', { signal: controller.signal })
            const stored = await fix.soft.collection.findOne({ _id: objectId(created.id) })

            expect(created).toMatchObject({
                __v: 0,
                createdAt: expect.any(Temporal.Instant),
                deletedAt: null,
                id: expect.any(String),
                name: 'sample',
                updatedAt: expect.any(Temporal.Instant)
            })
            expect(created).not.toHaveProperty('_id')
            expect(stored).toMatchObject({
                _id: objectId(created.id),
                createdAt: expect.any(Date),
                name: 'sample',
                updatedAt: expect.any(Date)
            })
            expect(stored).not.toHaveProperty('id')
            expect(insertOne).toHaveBeenCalledWith(
                expect.any(Object),
                expect.objectContaining({ signal: controller.signal })
            )
        })

        it('여러 문서를 한 번에 생성한다', async () => {
            const controller = new AbortController()
            const insertMany = vi.spyOn(fix.soft.collection, 'insertMany')
            const docs = await fix.soft.createMany(['a', 'b', 'c'], { signal: controller.signal })

            expect(docs).toHaveLength(3)
            for (const doc of docs) {
                expect(doc.id).toEqual(expect.any(String))
                expect(doc).not.toHaveProperty('_id')
            }
            await expect(
                fix.soft.findMany({ ids: docs.map(({ id }) => id) })
            ).resolves.toHaveLength(3)
            expect(insertMany).toHaveBeenCalledWith(
                expect.any(Array),
                expect.objectContaining({ signal: controller.signal })
            )
        })

        it('빈 배열 insert는 driver를 호출하지 않는다', async () => {
            const insertMany = vi.spyOn(fix.soft.collection, 'insertMany')

            await fix.soft.insertDrafts([])

            expect(insertMany).not.toHaveBeenCalled()
        })

        it('중단된 신호는 쓰기를 시작하기 전에 거부한다', async () => {
            const controller = new AbortController()
            controller.abort(new Error('cancelled'))

            await expect(
                fix.soft.create('cancelled', { signal: controller.signal })
            ).rejects.toThrow('cancelled')
            await expect(
                fix.soft.insertDrafts(
                    [fix.soft.draft('cancelled-many')],
                    undefined,
                    controller.signal
                )
            ).rejects.toThrow('cancelled')
            await expect(fix.soft.collection.countDocuments({})).resolves.toBe(0)
        })

        it('insertMany 처리 수가 입력 수와 다르면 불변식 오류를 던진다', async () => {
            vi.spyOn(fix.soft.collection, 'insertMany').mockResolvedValueOnce({
                acknowledged: true,
                insertedCount: 1,
                insertedIds: { 0: objectId(fix.soft.draft('a').id) }
            })

            await expect(
                fix.soft.insertDrafts([fix.soft.draft('a'), fix.soft.draft('b')])
            ).rejects.toThrow(
                expect.objectContaining({ status: 500, cause: expect.stringMatching(/!==/) })
            )
        })

        it('projection을 공용 조회에 적용한다', async () => {
            const draft = fix.projected.draft('projected')
            draft.secret = 'hidden'
            await fix.projected.insertDrafts([draft])

            const found = await fix.projected.get({ id: draft.id })
            const raw = await fix.projected.collection.findOne({ _id: objectId(draft.id) })

            expect(found).not.toHaveProperty('secret')
            expect(raw).toMatchObject({ secret: 'hidden' })
        })

        it('hard-delete 문서에는 deletedAt을 만들지 않는다', async () => {
            const created = await fix.hard.create('hard')
            const raw = await fix.hard.collection.findOne({ _id: objectId(created.id) })

            expect(created).not.toHaveProperty('deletedAt')
            expect(raw).not.toHaveProperty('deletedAt')
        })
    })

    describe('find, get, findMany, getMany, allExist', () => {
        it('find/get 단건 조회와 누락을 구분한다', async () => {
            const created = await fix.soft.create('sample')
            const missingId = objectId('000000000000000000000000').toHexString()

            await expect(fix.soft.find({ id: created.id })).resolves.toMatchObject({
                id: created.id,
                name: 'sample'
            })
            await expect(fix.soft.find({ id: missingId })).resolves.toBeNull()
            await expect(fix.soft.get({ id: missingId })).rejects.toBeInstanceOf(NotFoundException)
            await expect(fix.soft.get({ id: missingId })).rejects.toMatchObject({
                response: MongoErrors.DocumentNotFound(missingId)
            })
        })

        it('findMany는 없는 ID를 무시하고 getMany는 정확한 누락 ID를 보고한다', async () => {
            const [first, second] = await fix.soft.createMany(['a', 'b'])
            if (!first || !second) throw new Error('samples must exist')
            const missingId = '000000000000000000000000'

            await expect(fix.soft.findMany({ ids: [first.id, missingId] })).resolves.toEqual([
                expect.objectContaining({ id: first.id })
            ])
            await expect(fix.soft.getMany({ ids: [first.id, missingId] })).rejects.toMatchObject({
                response: MongoErrors.MultipleDocumentsNotFound([missingId])
            })
            await expect(fix.soft.getMany({ ids: [first.id, second.id] })).resolves.toHaveLength(2)
        })

        it('getMany는 중복 ID를 경고하고 한 번만 반환한다', async () => {
            const created = await fix.soft.create('sample')
            const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)

            const docs = await fix.soft.getMany({ ids: [created.id, created.id] })

            expect(docs).toHaveLength(1)
            expect(warn).toHaveBeenCalledWith(expect.stringContaining('Duplicate IDs detected'))
        })

        it('allExist는 빈 배열·중복·누락을 처리한다', async () => {
            const created = await fix.soft.create('sample')

            await expect(fix.soft.allExist([])).resolves.toBe(true)
            await expect(fix.soft.allExist([created.id, created.id])).resolves.toBe(true)
            await expect(fix.soft.allExist(['000000000000000000000000'])).resolves.toBe(false)
        })
    })

    describe('delete, deleteMany', () => {
        it('soft delete는 문서를 남기되 공용 조회에서 제외한다', async () => {
            const created = await fix.soft.create('soft')

            await fix.soft.delete({ id: created.id })

            await expect(fix.soft.find({ id: created.id })).resolves.toBeNull()
            const raw = await fix.soft.collection.findOne({ _id: objectId(created.id) })
            expect(raw).toMatchObject({ deletedAt: expect.any(Date), updatedAt: expect.any(Date) })
        })

        it('soft delete 단건은 없는 문서를 404로 처리한다', async () => {
            const missingId = '000000000000000000000000'

            await expect(fix.soft.delete({ id: missingId })).rejects.toMatchObject({
                response: MongoErrors.DocumentNotFound(missingId)
            })
        })

        it('soft delete 여러 건은 실제 변경 수를 반환하고 재삭제는 0이다', async () => {
            const docs = await fix.soft.createMany(['a', 'b'])
            const ids = docs.map(({ id }) => id)

            await expect(fix.soft.deleteMany({ ids })).resolves.toEqual({ deletedCount: 2 })
            await expect(fix.soft.deleteMany({ ids })).resolves.toEqual({ deletedCount: 0 })
        })

        it('hard delete는 문서를 실제로 지우고 없는 단건은 404다', async () => {
            const [first, second] = await fix.hard.createMany(['a', 'b'])
            if (!first || !second) throw new Error('samples must exist')

            await fix.hard.delete({ id: first.id })
            await expect(
                fix.hard.collection.findOne({ _id: objectId(first.id) })
            ).resolves.toBeNull()
            await expect(fix.hard.delete({ id: first.id })).rejects.toBeInstanceOf(
                NotFoundException
            )
            await expect(fix.hard.deleteMany({ ids: [second.id] })).resolves.toEqual({
                deletedCount: 1
            })
        })
    })

    describe('findWithPagination', () => {
        it('page, size와 정렬 구간을 반환한다', async () => {
            await fix.soft.createMany(['d', 'a', 'c', 'b', 'e'])

            const result = await fix.soft.findWithPagination({
                pagination: {
                    orderby: { direction: OrderDirection.Asc, name: 'name' },
                    page: 2,
                    size: 2
                }
            })

            expect(result).toMatchObject({ page: 2, size: 2, total: 5 })
            expect(result.items.map(({ name }) => name)).toEqual(['c', 'd'])

            const ItemSchema = z.object({ name: z.string(), createdAt: InstantFromInputSchema })
            const restored = paginationResultSchema(ItemSchema).parse(
                JSON.parse(JsonUtil.stringify(result))
            )
            expect(restored).toEqual({
                ...result,
                items: result.items.map(({ name, createdAt }) => ({ name, createdAt }))
            })
        })

        it('내림차순과 기본 page/size를 적용한다', async () => {
            await fix.soft.createMany(['a', 'c', 'b', 'd'])

            const result = await fix.soft.findWithPagination({
                pagination: {
                    orderby: { direction: OrderDirection.Desc, name: 'name' },
                    page: null,
                    size: null
                }
            })

            expect(result).toMatchObject({ page: 1, size: 3, total: 4 })
            expect(result.items.map(({ name }) => name)).toEqual(['d', 'c', 'b'])
        })

        it('size가 범위를 벗어나면 400으로 거부한다', async () => {
            await expect(
                fix.soft.findWithPagination({ pagination: { size: 0 } })
            ).rejects.toBeInstanceOf(BadRequestException)
            await expect(
                fix.soft.findWithPagination({ pagination: { size: 6 } })
            ).rejects.toMatchObject({ response: MongoErrors.MaxSizeExceeded(5, 6) })
        })

        it('필터가 없어도 soft-deleted 문서를 total에서 제외한다', async () => {
            const [active, deleted] = await fix.soft.createMany(['active', 'deleted'])
            if (!active || !deleted) throw new Error('samples must exist')
            await fix.soft.delete({ id: deleted.id })
            const estimated = vi.spyOn(fix.soft.collection, 'estimatedDocumentCount')
            const count = vi.spyOn(fix.soft.collection, 'countDocuments')

            const result = await fix.soft.findWithPagination({ pagination: {} })

            expect(result.total).toBe(1)
            expect(result.items).toEqual([expect.objectContaining({ id: active.id })])
            expect(count).toHaveBeenCalledWith(
                { $and: [{}, { deletedAt: null }] },
                { session: undefined }
            )
            expect(estimated).not.toHaveBeenCalled()
        })

        it('필터가 있으면 active filter를 포함한 정확한 count를 사용한다', async () => {
            const [active, deleted] = await fix.soft.createMany(['target', 'target'])
            if (!active || !deleted) throw new Error('samples must exist')
            await fix.soft.delete({ id: deleted.id })
            const estimated = vi.spyOn(fix.soft.collection, 'estimatedDocumentCount')
            const count = vi.spyOn(fix.soft.collection, 'countDocuments')

            const result = await fix.soft.findWithPagination({
                filter: { name: 'target' },
                pagination: {}
            })

            expect(result.total).toBe(1)
            expect(result.items).toEqual([expect.objectContaining({ id: active.id })])
            expect(count).toHaveBeenCalledWith(
                { $and: [{ name: 'target' }, { deletedAt: null }] },
                { session: undefined }
            )
            expect(estimated).not.toHaveBeenCalled()
        })
    })

    describe('activeFilter, timestamped', () => {
        it('soft/hard active filter를 구분한다', () => {
            const filter = { name: 'sample' }

            expect(fix.soft.toActiveFilter(filter)).toEqual({ $and: [filter, { deletedAt: null }] })
            expect(fix.hard.toActiveFilter(filter)).toEqual(filter)
        })

        it('갱신에 timestamp와 version 증가를 합친다', () => {
            const update = fix.soft.toTimestamped({
                $inc: { count: 2 },
                $set: { name: 'changed' },
                $unset: { old: 1 }
            })

            expect(update).toMatchObject({
                $inc: { __v: 1, count: 2 },
                $set: { name: 'changed', updatedAt: expect.any(Date) },
                $unset: { old: 1 }
            })
            expect(fix.soft.toTimestamped({})).toMatchObject({
                $inc: { __v: 1 },
                $set: { updatedAt: expect.any(Date) }
            })
        })
    })

    describe('withTransaction', () => {
        it('여러 Repository의 쓰기를 함께 커밋하고 세션을 종료한다', async () => {
            const started = vi.spyOn(fix.client, 'startSession')
            const { soft, hard, transaction } = await fix.soft.withTransaction(
                async (transaction) => ({
                    soft: await fix.soft.create('committed', { transaction }),
                    hard: await fix.hard.create('also-committed', { transaction }),
                    transaction
                })
            )

            await expect(fix.soft.find({ id: soft.id })).resolves.toMatchObject({
                name: 'committed'
            })
            await expect(fix.hard.find({ id: hard.id })).resolves.toMatchObject({
                name: 'also-committed'
            })
            expect(started.mock.results[0]?.value).toMatchObject({ hasEnded: true })
            await expect(fix.soft.find({ id: soft.id, transaction })).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Transaction context is no longer active.'
                })
            )
            await expect(fix.hard.create('late-write', { transaction })).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Transaction context is no longer active.'
                })
            )
        })

        it('콜백이 실패하면 여러 Repository의 쓰기를 롤백하고 세션을 종료한다', async () => {
            const started = vi.spyOn(fix.client, 'startSession')
            let created: { soft: Sample; hard: Sample; transaction: TransactionContext } | undefined

            const result = fix.soft.withTransaction(async (transaction) => {
                created = {
                    soft: await fix.soft.create('rolled-back', { transaction }),
                    hard: await fix.hard.create('also-rolled-back', { transaction }),
                    transaction
                }
                throw new Error('boom')
            })

            await expect(result).rejects.toThrow('boom')
            if (!created) throw new Error('transaction should create draft documents')
            await expect(fix.soft.find({ id: created.soft.id })).resolves.toBeNull()
            await expect(fix.hard.find({ id: created.hard.id })).resolves.toBeNull()
            expect(started.mock.results[0]?.value).toMatchObject({ hasEnded: true })
            await expect(
                fix.hard.find({ id: created.hard.id, transaction: created.transaction })
            ).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Transaction context is no longer active.'
                })
            )
        })

        it('동시에 실행한 트랜잭션의 커밋과 롤백은 서로 섞이지 않는다', async () => {
            let releaseFirst!: () => void
            const firstMayFinish = new Promise<void>((resolve) => (releaseFirst = resolve))
            let firstWriteDone!: () => void
            const firstWrote = new Promise<void>((resolve) => (firstWriteDone = resolve))
            let rolledBackId: string | undefined
            const first = fix.soft.withTransaction(async (transaction) => {
                const created = await fix.hard.create('rolled-back', { transaction })
                rolledBackId = created.id
                firstWriteDone()
                await firstMayFinish
                throw new Error('abort first')
            })
            const firstRejected = expect(first).rejects.toThrow('abort first')
            await firstWrote

            try {
                const committed = await fix.hard.withTransaction(async (transaction) =>
                    fix.soft.create('committed', { transaction })
                )
                await expect(fix.soft.find({ id: committed.id })).resolves.toMatchObject({
                    name: 'committed'
                })
            } finally {
                releaseFirst()
                await firstRejected
            }

            if (!rolledBackId) throw new Error('first transaction should create a draft id')
            await expect(fix.hard.find({ id: rolledBackId })).resolves.toBeNull()
        })

        it('일시 오류가 아니면 callback을 재시도하지 않는다', async () => {
            let attempts = 0

            await expect(
                fix.soft.withTransaction(async () => {
                    attempts++
                    throw new Error('permanent')
                })
            ).rejects.toThrow('permanent')
            expect(attempts).toBe(1)
        })

        it('WriteConflict가 나면 driver 재시도 뒤 성공한다', async () => {
            const created = await fix.soft.create('initial')
            let releaseFirst!: () => void
            const firstMayFinish = new Promise<void>((resolve) => (releaseFirst = resolve))
            let firstWriteDone!: () => void
            const firstWrote = new Promise<void>((resolve) => (firstWriteDone = resolve))

            const first = fix.soft.withTransaction(async (transaction) => {
                await fix.soft.rename(created.id, 'first', transaction)
                firstWriteDone()
                await firstMayFinish
            })
            await firstWrote

            let attempts = 0
            const transactions: TransactionContext[] = []
            try {
                await fix.soft.withTransaction(
                    async (transaction) => {
                        transactions.push(transaction)
                        attempts++
                        if (attempts === 2) {
                            releaseFirst()
                            await first
                        }
                        await fix.soft.rename(created.id, 'second', transaction)
                    },
                    { snapshot: { commitTimeoutMs: 10_000, timeoutMs: 45_000 } }
                )
            } finally {
                releaseFirst()
                await first
            }

            expect(attempts).toBe(2)
            expect(transactions[0]).not.toBe(transactions[1])
            await expect(
                fix.soft.find({ id: created.id, transaction: transactions[0] })
            ).rejects.toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Transaction context is no longer active.'
                })
            )
            await expect(fix.soft.find({ id: created.id })).resolves.toMatchObject({
                name: 'second'
            })
        })
    })
})

class RepositoryHarness extends CrudRepository<Sample> {
    constructor(
        collection: Collection,
        client: MongoClient,
        options: { hardDelete?: boolean; indexes?: IndexDescription[] } = {}
    ) {
        super(
            new MongoConnection(client, { collection: () => collection } as unknown as Db, false),
            'sample',
            10,
            100,
            options
        )
    }
}
