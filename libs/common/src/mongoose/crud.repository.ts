import type {
    ClientSession,
    HydratedDocument,
    Model,
    QueryFilter,
    QueryWithHelpers
} from 'mongoose'
import { BadRequestException, NotFoundException, type OnModuleInit } from '@nestjs/common'
import type { PaginationDto, PaginationResult } from '../pagination'
import { Assume, defaultTo, differenceWith, Require, sleep, uniq } from '../utils'
import { MongooseErrors } from './errors'
import { isTransientTransactionError, objectId, objectIds } from './mongoose.util'

type BulkSaveDocs<Doc> = Parameters<Model<Doc>['bulkSave']>[0]
type SessionArg = ClientSession | undefined

const defaultLeanOptions = {}

// 트랜잭션 안에서는 충돌이 잠금 대기 없이 즉시 WriteConflict로 반환된다(yield 비활성).
// 지연 없이 곧장 다시 시도하면 경쟁 트랜잭션이 커밋하기 전에 시도가 모두 소진돼, 일시 오류가 도메인 결과 대신 5xx로 샌다.
// 그래서 시도마다 백오프로 잠깐 물러나고, 그 사이 경쟁자가 커밋하면 재시도는 전이 실패(409) 같은 도메인 결과로 수렴한다.
const TRANSACTION_MAX_ATTEMPTS = 5
const TRANSACTION_RETRY_BASE_MS = 10

// base × 2^(attempt-1) 범위에서 무작위로 고르는 지수 백오프(풀 지터)다.
// 같은 시각에 깨어난 패자들이 다시 한꺼번에 몰려 재충돌하는 것을 흩뜨린다.
function transactionRetryBackoffMs(attempt: number): number {
    return Math.random() * TRANSACTION_RETRY_BASE_MS * 2 ** (attempt - 1)
}

// 입력으로 받은 `doc`을 그대로 수정하고 같은 참조를 반환한다.
//
// `lean()` 결과는 `{ _id: ObjectId, ... }` 형태로 반환된다.
// 스키마 가상 필드의 `id: string`과 `toJSON.flattenObjectIds`는 hydrated 문서에만 적용된다.
// `lean` 결과에 같은 효과를 보려면 `mongoose-lean-virtuals` 플러그인을 추가해야 하는데, 그 플러그인은 페이지네이션 읽기 처리량을 유의미하게 낮춘다.
// 그래서 여기서 문자열 `id`를 직접 설정한다.
//
// `_id`는 의도적으로 남겨 둔다.
// 내부 코드 일부가 비교를 위해 `doc._id.toString()`을 쓰고 있고, HTTP 응답으로 나갈 때는 어차피 직렬화 단계에서 빠진다.
export function leanToPublic<T extends { _id?: unknown }>(doc: T): T {
    if (doc._id != null) {
        ;(doc as any).id = (doc._id as { toString(): string }).toString()
    }
    return doc
}

// `lean()` 결과를 공개 타입으로 바꾸는 두 헬퍼이다.
// mongoose가 추론하는 `lean()` 결과 타입이 `T extends { _id?: unknown }` 제약과 바로 맞물리지 않아서, 호출 지점마다 같은 형 변환을 반복하던 부분을 한 곳으로 모았다.
//
// `leanToPublic`을 그대로 부르므로, 입력 문서들도 그 자리에서 같이 바뀐다.
export function leanArrayToPublic<T>(docs: unknown): T[] {
    return (docs as any[]).map(leanToPublic) as T[]
}

export function leanOneToPublic<T>(doc: unknown): null | T {
    return doc ? (leanToPublic(doc as any) as T) : null
}

/**
 * CRUD 도메인용 리포지토리 기반 클래스.
 * 보통의 도메인 엔티티가 쓰는 조회, 저장, 삭제, 페이지네이션, 트랜잭션을 한곳에서 제공한다.
 *
 * 감사 로그처럼 추가만 일어나는 도메인은 이 기반이 아니라 `AppendOnlyRepository`를 사용한다.
 * 해당 구현은 삭제·수정 메서드를 타입 차원에서 노출하지 않는다.
 */
export abstract class CrudRepository<Doc> implements OnModuleInit {
    // defaultSize는 호출자가 size를 생략했을 때의 페이지 크기, maxSize는 요청이 넘을 수 없는 상한이다.
    // 한 값이 두 역할을 겸하면 기본값을 조정할 때 상한까지 따라 움직여 호출자들이 깨진다.
    constructor(
        protected readonly model: Model<Doc>,
        protected readonly defaultSize: number,
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

        const size = defaultTo(pagination.size, this.defaultSize)
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

        // 페이지네이션은 조회와 카운트를 함께 실행한다.
        // 필터가 비어 있을 때 카운트가 조회보다 몇 배는 느리게 관측됐다.
        // `CrudSchema`의 pre hook이 포함되면서 `countDocuments`가 사실상 `{ deletedAt: null }` 카운트로 바뀌고, 삭제되지 않은 모든 행에 대한 인덱스 스캔이 되기 때문이다.
        // `estimatedDocumentCount`는 컬렉션 메타데이터만 읽으므로 즉시 반환된다.
        // 그래서 필터가 빈 경로에서는 이 경로를 사용한다.
        //
        // 한 가지 한계가 있다.
        // `estimatedDocumentCount`는 소프트 삭제된 행까지 포함한 전체 수를 반환한다.
        // 응답의 `total`이 실제로 페이지에 표시되는 행보다 커질 수 있다.
        // 마지막 페이지에 빈자리가 생길 수는 있지만 정렬은 일관되게 유지되므로, 이 서비스에서는 받아들일 만한 절충이다.
        const rawFilter = queryHelper.getQuery()
        const filterIsEmpty = Object.keys(rawFilter).length === 0

        const [rawItems, total] = await Promise.all([
            queryHelper.exec(),
            filterIsEmpty
                ? this.model.estimatedDocumentCount().exec()
                : this.model.countDocuments(rawFilter, { session }).exec()
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
        // `document.save()`가 내부적으로 `createCollection()`을 부른다.
        // 같은 시점에 여러 곳에서 `save()`가 호출되면 Mongo가 같은 컬렉션을 동시에 만들려 들면서 "Collection namespace is already in use" 에러를 낸다.
        // 단위 테스트처럼 빠르게 초기화를 반복하는 환경에서 자주 나타나는 증상이다.
        // 모듈 초기화 시점에 컬렉션과 인덱스를 미리 만들어 두면 이 경합이 사라진다.
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
    ): Promise<T> {
        // 같은 문서를 만진 동시 트랜잭션은 WriteConflict(TransientTransactionError 라벨)로 중단된다.
        // 드라이버 권고대로 백오프를 두고 트랜잭션 전체를 다시 시도한다(상한은 TRANSACTION_MAX_ATTEMPTS).
        for (let attempt = 1; ; attempt++) {
            try {
                return await this.runTransactionAttempt(callback)
            } catch (error) {
                if (attempt >= TRANSACTION_MAX_ATTEMPTS || !isTransientTransactionError(error)) {
                    throw error
                }
                await sleep(transactionRetryBackoffMs(attempt))
            }
        }
    }

    private async runTransactionAttempt<T>(
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
                // commit/abort가 던져도 세션은 반드시 반납해 누수를 막는다.
                try {
                    if (session.inTransaction()) {
                        if (state.rollbackRequested) {
                            await session.abortTransaction()
                        } else {
                            await session.commitTransaction()
                        }
                    }
                } finally {
                    await session.endSession()
                }
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
