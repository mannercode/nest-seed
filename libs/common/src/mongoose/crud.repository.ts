import type {
    ClientSession,
    HydratedDocument,
    Model,
    QueryFilter,
    QueryWithHelpers
} from 'mongoose'
import { BadRequestException, NotFoundException, type OnModuleInit } from '@nestjs/common'
import type { PaginationDto, PaginationResult } from '../pagination'
import { Assume, defaultTo, differenceWith, Require, uniq } from '../utils'
import { MongooseErrors } from './errors'
import { objectId, objectIds } from './mongoose.util'

type BulkSaveDocs<Doc> = Parameters<Model<Doc>['bulkSave']>[0]
type SessionArg = ClientSession | undefined

const defaultLeanOptions = {}

// **Mutates `doc` in place** and returns the same reference for convenience.
//
// Lean 결과는 `{ _id: ObjectId, ... }` 형태로 돌아온다. schema virtual 이
// `id: string` 을 노출하고 `toJSON.flattenObjectIds` 로 `_id` 를 떼지만,
// 그 transform 은 hydrated document 이거나 mongoose-lean-virtuals plugin
// 이 켜진 경우 (lean({ virtuals: true })) 에만 동작한다. plugin 을 켜면
// paginated endpoint 의 read RPS 가 약 30% 깎였다 (cycle-06 측정).
// 직접 set 하는 쪽이 훨씬 싸고 기존의 public `id: string` response shape
// 도 유지된다.
//
// `id` 만 추가하고 in-memory doc 의 `_id` 는 그대로 둔다: downstream
// 내부 코드 (`getByIds` 와 caller) 가 비교를 위해 여전히
// `doc._id.toString()` 을 하기 때문이고, HTTP response serialization 이
// 알아서 `_id` 를 떨군다 (실측 — lean POJO 가 어떤 serialization layer
// 를 거치며 `_id` 를 가리는데, 아마 global NestJS interceptor 거나
// schema 에서 파생된 class-transformer 설정일 것이다 — 어쨌든 wire 까지
// 도달하지 않는다).
export function leanToPublic<T extends { _id?: unknown }>(doc: T): T {
    if (doc._id != null) {
        ;(doc as any).id = (doc._id as { toString(): string }).toString()
    }
    return doc
}

// Lean 결과를 public 타입으로 변환하는 두 헬퍼. mongoose lean 타입(LeanDocument<T>)이
// `T extends { _id?: unknown }` 제약과 직접 호환되지 않아 호출자마다 동일한 cast가
// 반복되던 패턴을 한 곳으로 응축. 동작은 leanToPublic 그대로.
//
// Note: `leanToPublic` 으로 위임하므로 입력 doc 들을 **in place 로 mutate** 한다.
export function leanArrayToPublic<T>(docs: unknown): T[] {
    return (docs as any[]).map(leanToPublic) as T[]
}

// Note: `leanToPublic` 으로 위임하므로 입력 doc 을 **in place 로 mutate** 한다.
export function leanOneToPublic<T>(doc: unknown): null | T {
    return doc ? (leanToPublic(doc as any) as T) : null
}

/**
 * CRUD category 의 repository base.
 *
 * 일반적인 도메인 엔티티의 CRUD 동작 (find, save, delete, paginate, transaction) 을
 * 제공한다. Append-only category (audit log 등) 는 본 base 가 아니라
 * `AppendOnlyRepository` 를 사용한다 — delete/update 메서드를 타입에서 노출하지 않음.
 */
export abstract class CrudRepository<Doc> implements OnModuleInit {
    constructor(
        protected readonly model: Model<Doc>,
        protected readonly maxSize: number
    ) {}

    async deleteById(id: string, session: SessionArg = undefined) {
        const doc = await this.getDocumentById(id, session)
        await doc.deleteOne({ session })
    }

    async deleteByIds(ids: string[], session: SessionArg = undefined) {
        const { deletedCount } = await this.model.deleteMany(
            { _id: { $in: objectIds(ids) } } as QueryFilter<Doc>,
            { session }
        )

        return { deletedCount }
    }

    async allExist(ids: string[], session: SessionArg = undefined) {
        const uniqueIds = uniq(ids)
        if (uniqueIds.length === 0) return true

        const count = await this.model.countDocuments(
            { _id: { $in: objectIds(uniqueIds) } } as QueryFilter<Doc>,
            { session }
        )
        return count === uniqueIds.length
    }

    async findById(id: string, session: SessionArg = undefined) {
        const doc = await this.model
            .findById(objectId(id), null, { session })
            .lean(defaultLeanOptions)

        return leanOneToPublic<Doc>(doc)
    }

    async findByIds(ids: string[], session: SessionArg = undefined): Promise<Doc[]> {
        const docs = await this.model
            .find({ _id: { $in: objectIds(ids) } } as QueryFilter<Doc>, null, { session })
            .lean(defaultLeanOptions)

        return leanArrayToPublic<Doc>(docs)
    }

    async findWithPagination(args: {
        configureQuery?: (queryHelper: QueryWithHelpers<Array<Doc>, Doc>) => Promise<void>
        pagination: PaginationDto
        session?: SessionArg
    }) {
        const { configureQuery, pagination, session } = args

        const size = defaultTo(pagination.size, this.maxSize)
        const page = defaultTo(pagination.page, 1)

        if (size <= 0) {
            throw new BadRequestException(MongooseErrors.SizeInvalid(size))
        } else if (this.maxSize < size) {
            throw new BadRequestException(MongooseErrors.MaxSizeExceeded(this.maxSize, size))
        }

        const skip = (page - 1) * size

        const queryHelper = this.model.find({}, null, { session })
        queryHelper.limit(size)
        queryHelper.skip(skip)

        if (pagination.orderby) {
            const { direction, name } = pagination.orderby
            queryHelper.sort({ [name]: direction })
        }

        if (configureQuery) {
            await configureQuery(queryHelper)
        }

        queryHelper.lean(defaultLeanOptions)

        // Pagination 은 find + count 를 병렬로 돌린다. 빈 filter 에서는
        // count 가 find+skip+limit 보다 4~5배 느리게 측정됐다 (dev data;
        // list endpoint 에서 mongo primary 가 1000% CPU 를 먹었음).
        // CrudSchema pre-hook 이 끼면 countDocuments 는
        // countDocuments({ deletedAt: null }) 로 접혀 모든 non-deleted row
        // 에 대한 index scan 이 된다. estimatedDocumentCount 는 collection
        // metadata 만 읽으므로 (O(1)), 빈 filter 경로에서는 이 쪽을 쓴다.
        //
        // Tradeoff: estimatedDocumentCount 는 soft-deleted row 까지 포함한
        // *전체* row 수를 돌려주므로 보고되는 `total` 이 실제로 page 들에
        // 걸쳐 반환되는 row 수보다 커질 수 있다. 이 codebase 의 list
        // pagination 에서는 허용 가능한 절충 — soft-deleted row 는
        // `find` 에서 제외되므로 마지막 page 에 빈 자리가 생길 수는 있지만
        // 정렬은 일관되게 유지된다.
        const rawFilter = queryHelper.getQuery()
        const filterIsEmpty = Object.keys(rawFilter).length === 0

        const [rawItems, total] = await Promise.all([
            queryHelper.exec(),
            filterIsEmpty
                ? this.model.estimatedDocumentCount().exec()
                : this.model.countDocuments(rawFilter).exec()
        ])

        const items = leanArrayToPublic<Doc>(rawItems)
        return { items, page, size, total } as PaginationResult<Doc>
    }

    async getById(id: string, session: SessionArg = undefined) {
        const doc = await this.findById(id, session)

        if (!doc) {
            throw new NotFoundException(MongooseErrors.DocumentNotFound(id))
        }

        return doc
    }

    async getByIds(ids: string[], session: SessionArg = undefined) {
        const uniqueIds = uniq(ids)

        Assume.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)

        const docs = await this.findByIds(uniqueIds, session)

        const notFoundIds = differenceWith(
            uniqueIds,
            docs,
            (id, doc) => id === (doc as { _id: { toString(): string } })._id.toString()
        )

        if (notFoundIds.length > 0) {
            throw new NotFoundException(MongooseErrors.MultipleDocumentsNotFound(notFoundIds))
        }

        return docs
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }

    async onModuleInit() {
        /**
         * document.save()가 내부적으로 createCollection()을 호출한다.
         * 동시에 save()를 호출하면 "Collection namespace is already in use" 오류가 발생할 수 있다.
         * 이 문제는 주로 단위 테스트 환경에서 빈번한 초기화로 인해 발생한다.
         *
         * https://mongoosejs.com/docs/api/model.html#Model.createCollection()
         */
        await this.model.createCollection()
        await this.model.createIndexes()
    }

    async saveMany(docs: BulkSaveDocs<Doc>, session: SessionArg = undefined): Promise<void> {
        const { deletedCount, insertedCount, matchedCount } = await this.model.bulkSave(docs, {
            session
        })

        Require.equals(
            docs.length,
            insertedCount + matchedCount + deletedCount,
            `The number of inserted documents should match the requested count`
        )
    }

    async withTransaction<T>(
        callback: (session: ClientSession, rollback: () => void) => Promise<T>
    ) {
        const state = { rollbackRequested: false }
        const rollback = () => {
            state.rollbackRequested = true
        }

        let session: ClientSession | undefined

        try {
            session = await this.model.startSession()
            session.startTransaction()

            const result = await callback(session, rollback)
            return result
        } catch (error) {
            rollback()
            throw error
        } finally {
            if (session) {
                if (session.inTransaction()) {
                    if (state.rollbackRequested) {
                        await session.abortTransaction()
                    } else {
                        await session.commitTransaction()
                    }
                }
                await session.endSession()
            }
        }
    }

    protected async findDocumentById(id: string, session: SessionArg = undefined) {
        const doc = await this.model.findById(objectId(id), null, { session })

        return doc
    }

    protected async getDocumentById(id: string, session: SessionArg = undefined) {
        const doc = await this.findDocumentById(id, session)

        if (!doc) {
            throw new NotFoundException(MongooseErrors.DocumentNotFound(id))
        }

        return doc
    }
}
