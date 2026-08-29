import type { Collection, IndexDescription, MongoClient } from 'mongodb'
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common'
import { OrderDirection } from '../../pagination/index.js'
import { CrudRepository } from '../crud.repository.js'
import { MongoErrors } from '../errors.js'
import { objectId } from '../mongo.util.js'
import {
    createMongoRepositoryFixture,
    type Sample,
    type MongoRepositoryFixture
} from './crud.repository.fixture.js'

describe('CrudRepository', () => {
    let fix: MongoRepositoryFixture

    beforeAll(async () => {
        fix = await createMongoRepositoryFixture()
    })

    afterAll(async () => {
        await fix.teardown()
    })

    describe('initialization', () => {
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
    })

    describe('insert and mapping', () => {
        it('기본 필드를 채우고 public id는 저장하지 않는다', async () => {
            const controller = new AbortController()
            const insertOne = vi.spyOn(fix.soft.collection, 'insertOne')
            const created = await fix.soft.create('sample', { signal: controller.signal })
            const stored = await fix.soft.collection.findOne({ _id: objectId(created.id) })

            expect(created).toMatchObject({
                __v: 0,
                createdAt: expect.any(Date),
                deletedAt: null,
                id: expect.any(String),
                name: 'sample',
                updatedAt: expect.any(Date)
            })
            expect(stored).toMatchObject({ _id: objectId(created.id), name: 'sample' })
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
            await expect(fix.soft.findByIds(docs.map(({ id }) => id))).resolves.toHaveLength(3)
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
            ).rejects.toThrow(/!==/)
        })

        it('projection을 공용 조회에 적용한다', async () => {
            const draft = fix.projected.draft('projected')
            draft.secret = 'hidden'
            await fix.projected.insertDrafts([draft])

            const found = await fix.projected.getById(draft.id)
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

    describe('read contracts', () => {
        it('find/get 단건 조회와 누락을 구분한다', async () => {
            const created = await fix.soft.create('sample')
            const missingId = objectId('000000000000000000000000').toHexString()

            await expect(fix.soft.findById(created.id)).resolves.toMatchObject({
                id: created.id,
                name: 'sample'
            })
            await expect(fix.soft.findById(missingId)).resolves.toBeNull()
            await expect(fix.soft.getById(missingId)).rejects.toBeInstanceOf(NotFoundException)
            await expect(fix.soft.getById(missingId)).rejects.toMatchObject({
                response: MongoErrors.DocumentNotFound(missingId)
            })
        })

        it('findByIds는 없는 ID를 무시하고 getByIds는 정확한 누락 ID를 보고한다', async () => {
            const [first, second] = await fix.soft.createMany(['a', 'b'])
            if (!first || !second) throw new Error('samples must exist')
            const missingId = '000000000000000000000000'

            await expect(fix.soft.findByIds([first.id, missingId])).resolves.toEqual([
                expect.objectContaining({ id: first.id })
            ])
            await expect(fix.soft.getByIds([first.id, missingId])).rejects.toMatchObject({
                response: MongoErrors.MultipleDocumentsNotFound([missingId])
            })
            await expect(fix.soft.getByIds([first.id, second.id])).resolves.toHaveLength(2)
        })

        it('getByIds는 중복 ID를 경고하고 한 번만 반환한다', async () => {
            const created = await fix.soft.create('sample')
            const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)

            const docs = await fix.soft.getByIds([created.id, created.id])

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

    describe('delete contracts', () => {
        it('soft delete는 문서를 남기되 공용 조회에서 제외한다', async () => {
            const created = await fix.soft.create('soft')

            await fix.soft.deleteById(created.id)

            await expect(fix.soft.findById(created.id)).resolves.toBeNull()
            const raw = await fix.soft.collection.findOne({ _id: objectId(created.id) })
            expect(raw).toMatchObject({ deletedAt: expect.any(Date), updatedAt: expect.any(Date) })
        })

        it('soft delete 단건은 없는 문서를 404로 처리한다', async () => {
            const missingId = '000000000000000000000000'

            await expect(fix.soft.deleteById(missingId)).rejects.toMatchObject({
                response: MongoErrors.DocumentNotFound(missingId)
            })
        })

        it('soft delete 여러 건은 실제 변경 수를 반환하고 재삭제는 0이다', async () => {
            const docs = await fix.soft.createMany(['a', 'b'])
            const ids = docs.map(({ id }) => id)

            await expect(fix.soft.deleteByIds(ids)).resolves.toEqual({ deletedCount: 2 })
            await expect(fix.soft.deleteByIds(ids)).resolves.toEqual({ deletedCount: 0 })
        })

        it('hard delete는 문서를 실제로 지우고 없는 단건은 404다', async () => {
            const [first, second] = await fix.hard.createMany(['a', 'b'])
            if (!first || !second) throw new Error('samples must exist')

            await fix.hard.deleteById(first.id)
            await expect(
                fix.hard.collection.findOne({ _id: objectId(first.id) })
            ).resolves.toBeNull()
            await expect(fix.hard.deleteById(first.id)).rejects.toBeInstanceOf(NotFoundException)
            await expect(fix.hard.deleteByIds([second.id])).resolves.toEqual({ deletedCount: 1 })
        })
    })

    describe('pagination', () => {
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

        it('필터가 없으면 estimated count를 사용해 soft-deleted 문서도 total에 포함한다', async () => {
            const [active, deleted] = await fix.soft.createMany(['active', 'deleted'])
            if (!active || !deleted) throw new Error('samples must exist')
            await fix.soft.deleteById(deleted.id)
            const estimated = vi.spyOn(fix.soft.collection, 'estimatedDocumentCount')
            const count = vi.spyOn(fix.soft.collection, 'countDocuments')

            const result = await fix.soft.findWithPagination({ pagination: {} })

            expect(result.total).toBe(2)
            expect(result.items).toEqual([expect.objectContaining({ id: active.id })])
            expect(estimated).toHaveBeenCalledTimes(1)
            expect(count).not.toHaveBeenCalled()
        })

        it('필터가 있으면 active filter를 포함한 정확한 count를 사용한다', async () => {
            const [active, deleted] = await fix.soft.createMany(['target', 'target'])
            if (!active || !deleted) throw new Error('samples must exist')
            await fix.soft.deleteById(deleted.id)
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

    describe('protected helpers', () => {
        it('soft/hard active filter를 구분한다', () => {
            const filter = { name: 'sample' }

            expect(fix.soft.toActiveFilter(filter)).toEqual({ $and: [filter, { deletedAt: null }] })
            expect(fix.hard.toActiveFilter(filter)).toBe(filter)
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

        it('실제 초기화에서 빠진 인덱스를 만들었다', async () => {
            const indexes = await fix.soft.collection.listIndexes().toArray()
            const names = indexes.map(({ name }) => name)

            expect(names).toEqual(expect.arrayContaining(['_id_', 'deletedAt_1', 'name_lookup']))
        })
    })

    describe('transactions', () => {
        it('콜백이 성공하면 커밋하고 반환값을 보존한다', async () => {
            const created = await fix.soft.withTransaction(async (session) =>
                fix.soft.create('committed', { session })
            )

            await expect(fix.soft.findById(created.id)).resolves.toMatchObject({
                name: 'committed'
            })
        })

        it('콜백이 실패하면 롤백하고 원래 오류를 던진다', async () => {
            let createdId: string | undefined

            const transaction = fix.soft.withTransaction(async (session) => {
                const created = await fix.soft.create('rolled-back', { session })
                createdId = created.id
                throw new Error('boom')
            })

            await expect(transaction).rejects.toThrow('boom')
            if (!createdId) throw new Error('transaction should create a draft id')
            await expect(fix.soft.findById(createdId)).resolves.toBeNull()
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
            const _id = objectId(created.id)
            let releaseFirst!: () => void
            const firstMayFinish = new Promise<void>((resolve) => (releaseFirst = resolve))
            let firstWriteDone!: () => void
            const firstWrote = new Promise<void>((resolve) => (firstWriteDone = resolve))

            const first = fix.soft.withTransaction(async (session) => {
                await fix.soft.collection.updateOne(
                    { _id },
                    { $set: { name: 'first' } },
                    { session }
                )
                firstWriteDone()
                await firstMayFinish
            })
            await firstWrote

            let attempts = 0
            try {
                await fix.soft.withTransaction(
                    async (session) => {
                        attempts++
                        if (attempts === 2) {
                            releaseFirst()
                            await first
                        }
                        await fix.soft.collection.updateOne(
                            { _id },
                            { $set: { name: 'second' } },
                            { session }
                        )
                    },
                    { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
                )
            } finally {
                releaseFirst()
                await first
            }

            expect(attempts).toBe(2)
            await expect(fix.soft.findById(created.id)).resolves.toMatchObject({ name: 'second' })
        })
    })
})

class RepositoryHarness extends CrudRepository<Sample> {
    constructor(
        collection: Collection,
        client: MongoClient,
        options: { hardDelete?: boolean; indexes?: IndexDescription[] } = {}
    ) {
        super(collection, client, 10, 100, options)
    }
}
