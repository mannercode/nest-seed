import { type Collection, type Db, type IndexDescription, MongoClient } from 'mongodb'
import { BadRequestException, Logger, NotFoundException } from '@nestjs/common'
import type { TransactionContext } from '../../index.js'
import type { MockInstance } from 'vitest'
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
    SamplesRepository,
    type Sample,
    type MongoRepositoryFixture
} from './crud.repository.fixture.js'

describe('createMongoRepositoryFixture', () => {
    describe.each([
        { label: '연결 직후 초기화가 실패하면', stage: 'connect' },
        { label: '인덱스 초기화가 실패하면', stage: 'index' },
        { label: '인덱스 초기화와 연결 정리가 모두 실패하면', stage: 'cleanup' }
    ] as const)('$label', ({ stage }) => {
        let failure: Error
        let closeClient: (() => Promise<void>) | undefined
        let closeSpy: MockInstance<MongoClient['close']>
        beforeEach(async () => {
            failure = new Error('fixture initialization failed')
            const connect = MongoClient.prototype.connect
            const close = MongoClient.prototype.close
            closeClient = undefined
            vi.spyOn(MongoClient.prototype, 'connect').mockImplementationOnce(async function (
                this: MongoClient
            ) {
                closeClient = close.bind(this)
                await connect.call(this)
                if (stage === 'connect') throw failure
                return this
            })
            if (stage !== 'connect')
                vi.spyOn(SamplesRepository.prototype, 'onModuleInit').mockRejectedValueOnce(failure)
            closeSpy = vi
                .spyOn(MongoClient.prototype, 'close')
                .mockImplementationOnce(async function (this: MongoClient) {
                    await close.call(this)
                    if (stage === 'cleanup') throw new Error('cleanup failed')
                })
        })
        it('픽스처 생성 시 연결을 닫고 최초 초기화 오류를 던진다', async () => {
            try {
                await expect(createMongoRepositoryFixture()).rejects.toBe(failure)
                expect(closeSpy).toHaveBeenCalledTimes(1)
            } finally {
                await closeClient?.()
            }
        })
    })
})

describe('CrudRepository', () => {
    let fix: MongoRepositoryFixture

    beforeEach(async () => {
        fix = await createMongoRepositoryFixture()
    })

    afterEach(async () => {
        await fix.teardown()
    })

    describe('문서 연산', () => {
        describe('문서 하나가 존재하면', () => {
            let created: Sample
            beforeEach(async () => {
                created = await fix.soft.create('sample')
            })
            it('ObjectId 조건으로 조회·수정하면 결과 문서에 문자열 id만 반환한다', async () => {
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

            it('문서 ID와 문자열 그룹 키로 각각 집계하면 ObjectId 결과도 문자열로 반환한다', async () => {
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
        })

        describe('새 문서를 삽입할 ID와 수정 내용이 준비되었으면', () => {
            let id: string
            let update: {
                $setOnInsert: ReturnType<typeof fix.soft.idFilter>
                $set: { name: string }
            }
            beforeEach(() => {
                id = newObjectIdString()
                update = { $setOnInsert: fix.soft.idFilter(id), $set: { name: 'upserted' } }
            })
            it.each(['updateDocument', 'updateDocuments'] as const)(
                '%s로 upsert하면 BSON ID로 저장하고 문자열 ID를 반환한다',
                async (method) => {
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
        })

        describe('이름이 a·b·c인 문서가 존재하면', () => {
            beforeEach(async () => {
                await fix.soft.createMany(['a', 'b', 'c'])
            })
            it('조회 옵션으로 정렬 순서·개수·반환 필드를 지정할 수 있다', async () => {
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
        })

        describe('이름이 a·b인 문서가 존재하면', () => {
            beforeEach(async () => {
                await fix.soft.createMany(['a', 'b'])
            })
            it('문서를 수정하면 지정한 반환 옵션에 따라 수정 전후 문서와 수정 개수를 반환한다', async () => {
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

            it('트랜잭션 안에서 여러 문서를 수정·조회한 뒤 실패하면 변경을 모두 되돌린다', async () => {
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
                            await fix.soft.findDocuments(
                                { secret: 'inside' },
                                { transaction, signal }
                            )
                        ).toHaveLength(2)
                        expect(
                            await fix.soft.findDocument(
                                { name: 'changed' },
                                { transaction, signal }
                            )
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
        })

        describe('이름이 a인 문서 두 개와 b인 문서 한 개가 존재하면', () => {
            beforeEach(async () => {
                await fix.soft.createMany(['a', 'a', 'b'])
            })
            it('개수·고유 값·집계를 조회하면 해당 문서들을 반영한다', async () => {
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

        describe('soft delete와 추가 인덱스를 선언한 저장소가 있으면', () => {
            let nameIndex: IndexDescription
            let createIndexes: ReturnType<typeof harness>['createIndexes']
            let repository: RepositoryHarness
            beforeEach(() => {
                nameIndex = { key: { name: 1 }, name: 'name_lookup' }
                ;({ createIndexes, repository } = harness({ indexes: [nameIndex] }))
            })
            it('초기화하면 삭제 시각 인덱스와 추가 인덱스를 생성한다', async () => {
                await repository.onModuleInit()

                expect(createIndexes).toHaveBeenCalledWith([{ key: { deletedAt: 1 } }, nameIndex])
            })
        })

        describe('같은 client·namespace·인덱스 선언을 쓰는 저장소 두 개가 있으면', () => {
            let createIndexes: ReturnType<typeof harness>['createIndexes']
            let first: RepositoryHarness
            let second: RepositoryHarness
            beforeEach(() => {
                createIndexes = vi.fn(async () => [] as string[])
                const client = {} as MongoClient
                const namespace = `test.memoized${sequence++}`
                first = new RepositoryHarness(
                    { createIndexes, namespace } as unknown as Collection,
                    client
                )
                second = new RepositoryHarness(
                    { createIndexes, namespace } as unknown as Collection,
                    client
                )
            })
            it('동시에 초기화해도 인덱스 생성은 한 번만 호출한다', async () => {
                await Promise.all([first.onModuleInit(), second.onModuleInit()])

                expect(createIndexes).toHaveBeenCalledTimes(1)
            })
        })

        describe('이미 초기화한 컬렉션에 unique 인덱스를 추가로 선언하면', () => {
            let repository: SamplesRepository

            beforeEach(async () => {
                const collectionName = 'nativeCrudAdditionalIndexes'
                const first = new SamplesRepository(fix.client, collectionName, {
                    indexes: [{ key: { name: 1 }, name: 'name_lookup' }]
                })
                await first.onModuleInit()
                repository = new SamplesRepository(fix.client, collectionName, {
                    indexes: [{ key: { secret: 1 }, name: 'secret_unique', unique: true }]
                })
            })

            it('후속 초기화가 인덱스를 생성해 중복 쓰기를 거절한다', async () => {
                await repository.onModuleInit()

                expect(await repository.collection.listIndexes().toArray()).toEqual(
                    expect.arrayContaining([
                        expect.objectContaining({ name: 'secret_unique', unique: true })
                    ])
                )
                await repository.collection.insertOne({ secret: 'same' })
                await expect(
                    repository.collection.insertOne({ secret: 'same' })
                ).rejects.toMatchObject({ code: 11000 })
            })
        })

        describe('같은 이름의 인덱스를 다른 옵션으로 선언하면', () => {
            let repository: SamplesRepository

            beforeEach(() => {
                repository = new SamplesRepository(fix.client, fix.soft.collection.collectionName, {
                    indexes: [{ key: { name: 1 }, name: 'name_lookup', unique: true }]
                })
            })

            it('인덱스 옵션 충돌을 호출자에게 전달한다', async () => {
                await expect(repository.onModuleInit()).rejects.toMatchObject({ code: 86 })
            })
        })

        describe('복합 인덱스의 필드 순서가 다르면', () => {
            let first: SamplesRepository
            let second: SamplesRepository

            beforeEach(() => {
                const collectionName = 'nativeCrudOrderedIndexes'
                first = new SamplesRepository(fix.client, collectionName, {
                    hardDelete: true,
                    indexes: [
                        {
                            key: new Map([
                                ['name', 1],
                                ['secret', 1]
                            ])
                        }
                    ]
                })
                second = new SamplesRepository(fix.client, collectionName, {
                    hardDelete: true,
                    indexes: [
                        {
                            key: new Map([
                                ['secret', 1],
                                ['name', 1]
                            ])
                        }
                    ]
                })
            })

            it('동시에 초기화해도 두 인덱스를 모두 생성한다', async () => {
                await Promise.all([first.onModuleInit(), second.onModuleInit()])

                const indexes = await second.collection.listIndexes().toArray()
                expect(indexes.map(({ name }) => name)).toEqual(
                    expect.arrayContaining(['name_1_secret_1', 'secret_1_name_1'])
                )
            })
        })

        describe('첫 인덱스 생성이 실패하도록 설정하면', () => {
            let createIndexes: ReturnType<typeof harness>['createIndexes']
            let repository: RepositoryHarness
            beforeEach(() => {
                ;({ createIndexes, repository } = harness())

                createIndexes.mockRejectedValueOnce(new Error('index unavailable'))
            })
            it('초기화 실패 후 다시 호출하면 인덱스 생성을 재시도한다', async () => {
                await expect(repository.onModuleInit()).rejects.toThrow('index unavailable')
                await expect(repository.onModuleInit()).resolves.toBeUndefined()

                expect(createIndexes).toHaveBeenCalledTimes(2)
            })
        })

        describe('추가 인덱스가 없는 hard delete 저장소가 있으면', () => {
            let createIndexes: ReturnType<typeof harness>['createIndexes']
            let repository: RepositoryHarness
            beforeEach(() => {
                ;({ createIndexes, repository } = harness({ hardDelete: true }))
            })
            it('초기화해도 인덱스 생성을 호출하지 않는다', async () => {
                await repository.onModuleInit()

                expect(createIndexes).not.toHaveBeenCalled()
            })
        })

        describe('추가 인덱스를 선언한 hard delete 저장소가 있으면', () => {
            let sagaIndex: IndexDescription
            let createIndexes: ReturnType<typeof harness>['createIndexes']
            let repository: RepositoryHarness
            beforeEach(() => {
                sagaIndex = { key: { sagaId: 1 }, unique: true }
                ;({ createIndexes, repository } = harness({
                    hardDelete: true,
                    indexes: [sagaIndex]
                }))
            })
            it('초기화하면 선언한 인덱스를 생성한다', async () => {
                await repository.onModuleInit()

                expect(createIndexes).toHaveBeenCalledWith([sagaIndex])
            })
        })

        it('초기화할 때 기본 인덱스와 설정한 인덱스를 생성한다', async () => {
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

        describe('삽입할 문서 배열이 비어 있으면', () => {
            let documents: Parameters<typeof fix.soft.insertDrafts>[0]
            beforeEach(() => {
                documents = []
            })
            it('삽입을 요청해도 driver를 호출하지 않는다', async () => {
                const insertMany = vi.spyOn(fix.soft.collection, 'insertMany')

                await fix.soft.insertDrafts(documents)

                expect(insertMany).not.toHaveBeenCalled()
            })
        })

        describe('signal이 이미 취소되었으면', () => {
            let controller: AbortController
            beforeEach(() => {
                controller = new AbortController()
                controller.abort(new Error('cancelled'))
            })
            it('한 건 또는 여러 건의 저장을 요청하면 쓰기 전에 취소 오류를 던진다', async () => {
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
        })

        describe('insertMany가 저장 개수를 한 개로 반환하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(fix.soft.collection, 'insertMany').mockResolvedValueOnce({
                    acknowledged: true,
                    insertedCount: 1,
                    insertedIds: { 0: objectId(fix.soft.draft('a').id) }
                })
            })
            it('문서 두 개를 저장하면 개수 불일치 예외를 던진다', async () => {
                await expect(
                    fix.soft.insertDrafts([fix.soft.draft('a'), fix.soft.draft('b')])
                ).rejects.toThrow(
                    expect.objectContaining({ status: 500, cause: expect.stringMatching(/!==/) })
                )
            })
        })

        describe('제외 대상인 secret 필드를 가진 문서가 존재하면', () => {
            let draft: ReturnType<MongoRepositoryFixture['projected']['draft']>
            beforeEach(async () => {
                draft = fix.projected.draft('projected')
                draft.secret = 'hidden'
                await fix.projected.insertDrafts([draft])
            })
            it('공용 조회에서는 secret을 제외하고 원본 저장 값은 유지한다', async () => {
                const found = await fix.projected.get({ id: draft.id })
                const raw = await fix.projected.collection.findOne({ _id: objectId(draft.id) })

                expect(found).not.toHaveProperty('secret')
                expect(raw).toMatchObject({ secret: 'hidden' })
            })
        })

        describe('hard delete 저장소이면', () => {
            let repository: SamplesRepository
            beforeEach(() => {
                repository = fix.hard
            })
            it('문서를 생성하면 deletedAt 필드를 만들지 않는다', async () => {
                const created = await repository.create('hard')
                const raw = await repository.collection.findOne({ _id: objectId(created.id) })

                expect(created).not.toHaveProperty('deletedAt')
                expect(raw).not.toHaveProperty('deletedAt')
            })
        })
    })

    describe('find, get, findMany, getMany, allExist', () => {
        describe('ID에 알파벳이 포함된 문서가 존재하면', () => {
            const id = 'abcdef123456abcdef123456'
            const upperId = id.toUpperCase()
            const missingId = 'fedcba123456fedcba123456'
            let created: Sample

            beforeEach(async () => {
                const draft = { ...fix.soft.draft('sample'), id }
                await fix.soft.insertDrafts([draft])
                created = draft
            })

            describe('조회할 ID가 대문자로 쓰여 있으면', () => {
                let query: Parameters<typeof fix.soft.getMany>[0]
                beforeEach(() => {
                    query = { ids: [upperId] }
                })
                it('getMany로 조회하면 같은 문서를 한 번 반환한다', async () => {
                    await expect(fix.soft.getMany(query)).resolves.toEqual([created])
                })
            })

            describe('조회할 ID에 대문자로 쓴 기존 ID와 누락 ID가 섞여 있으면', () => {
                let query: Parameters<typeof fix.soft.getMany>[0]
                beforeEach(() => {
                    query = { ids: [upperId, missingId.toUpperCase()] }
                })
                it('getMany로 조회하면 실제 누락된 ID만 보고한다', async () => {
                    await expect(fix.soft.getMany(query)).rejects.toMatchObject({
                        response: MongoErrors.MultipleDocumentsNotFound([missingId])
                    })
                })
            })

            describe('조회할 목록에 대소문자만 다른 중복 ID가 있으면', () => {
                let ids: Parameters<typeof fix.soft.allExist>[0]
                beforeEach(() => {
                    ids = [id, upperId]
                })
                it('getMany로 조회하면 같은 문서를 한 번 반환한다', async () => {
                    await expect(fix.soft.getMany({ ids })).resolves.toEqual([created])
                })
                it('존재 여부를 확인하면 같은 문서로 판단해 true를 반환한다', async () => {
                    await expect(fix.soft.allExist(ids)).resolves.toBe(true)
                })
            })

            describe('조회할 ID에 대소문자가 다른 중복 ID와 누락 ID가 섞여 있으면', () => {
                let ids: Parameters<typeof fix.soft.allExist>[0]
                beforeEach(() => {
                    ids = [id, upperId, missingId.toUpperCase()]
                })
                it('존재 여부를 확인하면 false를 반환한다', async () => {
                    await expect(fix.soft.allExist(ids)).resolves.toBe(false)
                })
            })
        })

        describe('문서 하나가 존재하면', () => {
            let created: Sample
            beforeEach(async () => {
                created = await fix.soft.create('sample')
            })
            it('find로 기존 문서를 조회하면 문서를 반환한다', async () => {
                await expect(fix.soft.find({ id: created.id })).resolves.toMatchObject({
                    id: created.id,
                    name: 'sample'
                })
            })
            describe('조회할 ID에 해당하는 문서가 없으면', () => {
                let missingId: string
                beforeEach(() => {
                    missingId = objectId('000000000000000000000000').toHexString()
                })
                it('find로 조회하면 null을 반환한다', async () => {
                    await expect(fix.soft.find({ id: missingId })).resolves.toBeNull()
                })
                it('get으로 조회하면 찾을 수 없다는 예외를 던진다', async () => {
                    const result = fix.soft.get({ id: missingId })
                    await expect(result).rejects.toBeInstanceOf(NotFoundException)
                    await expect(result).rejects.toMatchObject({
                        response: MongoErrors.DocumentNotFound(missingId)
                    })
                })

                it('allExist로 존재 여부를 확인하면 false를 반환한다', async () => {
                    await expect(fix.soft.allExist([missingId])).resolves.toBe(false)
                })
            })

            describe('조회할 ID 목록에 중복이 있으면', () => {
                let query: Parameters<typeof fix.soft.getMany>[0]
                beforeEach(() => {
                    query = { ids: [created.id, created.id] }
                })
                it('getMany로 조회하면 경고를 남기고 문서는 한 번만 반환한다', async () => {
                    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)

                    const docs = await fix.soft.getMany(query)

                    expect(docs).toHaveLength(1)
                    expect(warn).toHaveBeenCalledWith(
                        expect.stringContaining('Duplicate IDs detected')
                    )
                })

                it('allExist로 존재 여부를 확인하면 true를 반환한다', async () => {
                    await expect(fix.soft.allExist(query.ids)).resolves.toBe(true)
                })
            })

            describe('조회할 ID 목록이 비어 있으면', () => {
                let ids: string[]
                beforeEach(() => {
                    ids = []
                })
                it('allExist로 존재 여부를 확인하면 true를 반환한다', async () => {
                    await expect(fix.soft.allExist(ids)).resolves.toBe(true)
                })
            })
        })

        describe('문서 두 개가 존재하면', () => {
            let samples: Sample[]
            beforeEach(async () => {
                samples = await fix.soft.createMany(['a', 'b'])
            })
            describe('조회할 ID에 기존 ID와 누락 ID가 섞여 있으면', () => {
                let first: Sample
                let missingId: string
                let ids: string[]
                beforeEach(() => {
                    const sample = samples[0]
                    if (!sample) throw new Error('sample must exist')
                    first = sample
                    missingId = '000000000000000000000000'
                    ids = [first.id, missingId]
                })
                it('findMany로 조회하면 기존 문서만 반환한다', async () => {
                    await expect(fix.soft.findMany({ ids })).resolves.toEqual([
                        expect.objectContaining({ id: first.id })
                    ])
                })
                it('getMany로 조회하면 누락된 ID를 담은 예외를 던진다', async () => {
                    await expect(fix.soft.getMany({ ids })).rejects.toMatchObject({
                        response: MongoErrors.MultipleDocumentsNotFound([missingId])
                    })
                })
            })
            it('getMany로 두 문서의 ID를 조회하면 두 문서를 모두 반환한다', async () => {
                const [first, second] = samples
                if (!first || !second) throw new Error('samples must exist')
                await expect(
                    fix.soft.getMany({ ids: [first.id, second.id] })
                ).resolves.toHaveLength(2)
            })
        })
    })

    describe('delete, deleteMany', () => {
        describe('soft delete 저장소에 문서가 존재하면', () => {
            let created: Sample
            beforeEach(async () => {
                created = await fix.soft.create('soft')
            })
            it('삭제하면 원본 문서는 삭제 시각과 함께 남고 공용 조회에서는 제외한다', async () => {
                await fix.soft.delete({ id: created.id })

                await expect(fix.soft.find({ id: created.id })).resolves.toBeNull()
                const raw = await fix.soft.collection.findOne({ _id: objectId(created.id) })
                expect(raw).toMatchObject({
                    deletedAt: expect.any(Date),
                    updatedAt: expect.any(Date)
                })
            })
        })

        describe('삭제할 ID에 해당하는 문서가 없으면', () => {
            let query: Parameters<typeof fix.soft.delete>[0]
            const missingId = '000000000000000000000000'
            beforeEach(() => {
                query = { id: missingId }
            })
            it('soft delete를 요청하면 찾을 수 없다는 예외를 던진다', async () => {
                await expect(fix.soft.delete(query)).rejects.toMatchObject({
                    response: MongoErrors.DocumentNotFound(missingId)
                })
            })
        })

        describe('soft delete 저장소에 문서 두 개가 존재하면', () => {
            let ids: string[]
            beforeEach(async () => {
                const docs = await fix.soft.createMany(['a', 'b'])
                ids = docs.map(({ id }) => id)
            })
            it('두 문서를 삭제하면 개수 2를 반환하고 같은 ID로 재삭제하면 0을 반환한다', async () => {
                await expect(fix.soft.deleteMany({ ids })).resolves.toEqual({ deletedCount: 2 })
                await expect(fix.soft.deleteMany({ ids })).resolves.toEqual({ deletedCount: 0 })
            })
        })

        describe('hard delete 저장소에 문서 두 개가 존재하면', () => {
            let samples: Sample[]
            beforeEach(async () => {
                samples = await fix.hard.createMany(['a', 'b'])
            })
            it('삭제하면 원본 문서가 사라지고 같은 ID의 재삭제는 찾을 수 없다는 예외를 던진다', async () => {
                const [first, second] = samples
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
    })

    describe('findWithPagination', () => {
        describe('저장된 문서가 존재하면', () => {
            let committed: Sample
            let count: MockInstance<MongoRepositoryFixture['soft']['collection']['countDocuments']>
            beforeEach(async () => {
                committed = await fix.soft.create('committed')
                const find = fix.soft.collection.find.bind(fix.soft.collection)
                const countDocuments = fix.soft.collection.countDocuments.bind(fix.soft.collection)
                let itemsRead = false

                vi.spyOn(fix.soft.collection, 'find').mockImplementation((...args) => {
                    const cursor = find(...args)
                    const toArray = cursor.toArray.bind(cursor)
                    vi.spyOn(cursor, 'toArray').mockImplementation(async () => {
                        const items = await toArray()
                        itemsRead = true
                        return items
                    })
                    return cursor
                })
                count = vi
                    .spyOn(fix.soft.collection, 'countDocuments')
                    .mockImplementation((...args) => {
                        expect(itemsRead).toBe(true)
                        return countDocuments(...args)
                    })
            })
            it('트랜잭션에서 페이지를 조회하면 미커밋 변경을 반영하고 롤백 후에는 기존 문서를 반환한다', async () => {
                await expect(
                    fix.soft.withTransaction(async (transaction) => {
                        const created = await fix.soft.create('uncommitted', { transaction })
                        await fix.soft.delete({ id: committed.id, transaction })

                        const result = await fix.soft.findWithPagination({
                            pagination: {},
                            transaction
                        })

                        expect(result).toEqual({ items: [created], page: 1, size: 3, total: 1 })
                        expect(count).toHaveBeenCalledTimes(1)
                        throw new Error('rollback pagination changes')
                    })
                ).rejects.toThrow('rollback pagination changes')

                expect(await fix.soft.findWithPagination({ pagination: {} })).toEqual({
                    items: [committed],
                    page: 1,
                    size: 3,
                    total: 1
                })
            })
        })

        describe('이름이 d·a·c·b·e인 문서가 존재하면', () => {
            beforeEach(async () => {
                await fix.soft.createMany(['d', 'a', 'c', 'b', 'e'])
            })
            describe('정렬이 이름 오름차순이고 page와 size가 2이면', () => {
                let query: Parameters<typeof fix.soft.findWithPagination>[0]
                beforeEach(() => {
                    query = {
                        pagination: {
                            orderby: { direction: OrderDirection.Asc, name: 'name' },
                            page: 2,
                            size: 2
                        }
                    }
                })
                it('페이지를 조회하면 조건에 맞는 문서와 전체 개수를 반환한다', async () => {
                    const result = await fix.soft.findWithPagination(query)

                    expect(result).toMatchObject({ page: 2, size: 2, total: 5 })
                    expect(result.items.map(({ name }) => name)).toEqual(['c', 'd'])

                    const ItemSchema = z.object({
                        name: z.string(),
                        createdAt: InstantFromInputSchema
                    })
                    const restored = paginationResultSchema(ItemSchema).parse(
                        JSON.parse(JsonUtil.stringify(result))
                    )
                    expect(restored).toEqual({
                        ...result,
                        items: result.items.map(({ name, createdAt }) => ({ name, createdAt }))
                    })
                })
            })
        })

        describe('이름이 a·c·b·d인 문서가 존재하면', () => {
            beforeEach(async () => {
                await fix.soft.createMany(['a', 'c', 'b', 'd'])
            })
            describe('정렬이 이름 내림차순이고 page와 size가 null이면', () => {
                let query: Parameters<typeof fix.soft.findWithPagination>[0]
                beforeEach(() => {
                    query = {
                        pagination: {
                            orderby: { direction: OrderDirection.Desc, name: 'name' },
                            page: null,
                            size: null
                        }
                    }
                })
                it('페이지를 조회하면 기본 페이지 크기를 적용한다', async () => {
                    const result = await fix.soft.findWithPagination(query)

                    expect(result).toMatchObject({ page: 1, size: 3, total: 4 })
                    expect(result.items.map(({ name }) => name)).toEqual(['d', 'c', 'b'])
                })
            })
        })

        describe('페이지 크기가 0이면', () => {
            let query: Parameters<typeof fix.soft.findWithPagination>[0]
            beforeEach(() => {
                query = { pagination: { size: 0 } }
            })
            it('페이지를 조회하면 BadRequestException을 던진다', async () => {
                await expect(fix.soft.findWithPagination(query)).rejects.toBeInstanceOf(
                    BadRequestException
                )
            })
        })
        describe('페이지 크기가 상한을 넘으면', () => {
            let query: Parameters<typeof fix.soft.findWithPagination>[0]
            beforeEach(() => {
                query = { pagination: { size: 6 } }
            })
            it('페이지를 조회하면 상한 초과 예외를 던진다', async () => {
                await expect(fix.soft.findWithPagination(query)).rejects.toMatchObject({
                    response: MongoErrors.MaxSizeExceeded(5, 6)
                })
            })
        })

        describe('삭제하지 않은 문서와 soft delete한 문서가 각각 한 개 있으면', () => {
            let active: Sample
            let estimated: MockInstance
            let count: MockInstance
            beforeEach(async () => {
                const samples = await fix.soft.createMany(['target', 'target'])
                const [first, deleted] = samples
                if (!first || !deleted) throw new Error('samples must exist')
                active = first
                await fix.soft.delete({ id: deleted.id })
                estimated = vi.spyOn(fix.soft.collection, 'estimatedDocumentCount')
                count = vi.spyOn(fix.soft.collection, 'countDocuments')
            })
            describe.each([
                { condition: '검색 필터를 지정하지 않았으면', filter: undefined },
                { condition: '이름 검색 필터가 있으면', filter: { name: 'target' } }
            ])('$condition', ({ filter }) => {
                let query: Parameters<typeof fix.soft.findWithPagination>[0]
                beforeEach(() => {
                    query = { filter, pagination: {} }
                })
                it('페이지를 조회하면 삭제한 문서를 목록과 전체 개수에서 제외한다', async () => {
                    const result = await fix.soft.findWithPagination(query)
                    expect(result.total).toBe(1)
                    expect(result.items).toEqual([expect.objectContaining({ id: active.id })])
                    expect(count).toHaveBeenCalledWith(
                        { $and: [filter ?? {}, { deletedAt: null }] },
                        { session: undefined }
                    )
                    expect(estimated).not.toHaveBeenCalled()
                })
            })
        })
    })

    describe('activeFilter, timestamped', () => {
        describe('soft delete 저장소이면', () => {
            let repository: SamplesRepository
            let filter: { name: string }
            beforeEach(() => {
                repository = fix.soft
                filter = { name: 'sample' }
            })
            it('조회 필터를 만들면 삭제되지 않은 문서만 찾는 조건을 추가한다', () => {
                expect(repository.toActiveFilter(filter)).toEqual({
                    $and: [filter, { deletedAt: null }]
                })
            })
        })

        describe('hard delete 저장소이면', () => {
            let repository: SamplesRepository
            let filter: { name: string }
            beforeEach(() => {
                repository = fix.hard
                filter = { name: 'sample' }
            })
            it('조회 필터를 만들면 입력한 조건을 그대로 반환한다', () => {
                expect(repository.toActiveFilter(filter)).toEqual(filter)
            })
        })

        describe('수정 조건에 증가·설정·삭제 연산이 있으면', () => {
            let input: Parameters<typeof fix.soft.toTimestamped>[0]
            beforeEach(() => {
                input = { $inc: { count: 2 }, $set: { name: 'changed' }, $unset: { old: 1 } }
            })
            it('수정 조건을 만들면 갱신 시각과 버전 증가를 추가하고 기존 연산을 유지한다', () => {
                const update = fix.soft.toTimestamped(input)

                expect(update).toMatchObject({
                    $inc: { __v: 1, count: 2 },
                    $set: { name: 'changed', updatedAt: expect.any(Date) },
                    $unset: { old: 1 }
                })
            })
        })

        describe('수정 조건이 비어 있으면', () => {
            let input: Parameters<typeof fix.soft.toTimestamped>[0]
            beforeEach(() => {
                input = {}
            })
            it('수정 조건을 만들면 갱신 시각과 버전 증가를 추가한다', () => {
                expect(fix.soft.toTimestamped(input)).toMatchObject({
                    $inc: { __v: 1 },
                    $set: { updatedAt: expect.any(Date) }
                })
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

        describe('콜백이 여러 Repository에 저장한 뒤 예외를 던지도록 설정하면', () => {
            let started: MockInstance<MongoClient['startSession']>
            let created: { soft: Sample; hard: Sample; transaction: TransactionContext } | undefined
            let callback: Parameters<typeof fix.soft.withTransaction>[0]
            beforeEach(async () => {
                started = vi.spyOn(fix.client, 'startSession')
                created = undefined
                callback = async (transaction) => {
                    created = {
                        soft: await fix.soft.create('rolled-back', { transaction }),
                        hard: await fix.hard.create('also-rolled-back', { transaction }),
                        transaction
                    }
                    throw new Error('boom')
                }
            })
            it('트랜잭션을 실행하면 모든 쓰기를 롤백하고 세션을 종료한다', async () => {
                const result = fix.soft.withTransaction(callback)

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

        describe('콜백이 일시적이지 않은 오류를 던지도록 설정하면', () => {
            let attempts: number
            let callback: Parameters<typeof fix.soft.withTransaction>[0]
            beforeEach(() => {
                attempts = 0
                callback = async () => {
                    attempts++
                    throw new Error('permanent')
                }
            })
            it('트랜잭션을 실행하면 콜백을 재시도하지 않는다', async () => {
                await expect(fix.soft.withTransaction(callback)).rejects.toThrow('permanent')
                expect(attempts).toBe(1)
            })
        })

        describe('문서가 존재하면', () => {
            let created: Sample
            beforeEach(async () => {
                created = await fix.soft.create('initial')
            })
            it('같은 문서를 동시에 수정하면 충돌한 트랜잭션을 재시도해 마지막 값을 저장한다', async () => {
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
