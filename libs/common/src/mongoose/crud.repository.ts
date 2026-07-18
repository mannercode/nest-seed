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

// lean 플러그인의 처리량 비용을 피하려고 입력 문서에 문자열 id를 직접 추가한다. 내부 비교용 _id는 남긴다.
export function leanToPublic<T extends { _id?: unknown }>(doc: T): T {
    if (doc._id != null) {
        ;(doc as any).id = (doc._id as { toString(): string }).toString()
    }
    return doc
}

export function leanArrayToPublic<T>(docs: unknown): T[] {
    return (docs as any[]).map(leanToPublic) as T[]
}

export function leanOneToPublic<T>(doc: unknown): null | T {
    return doc ? (leanToPublic(doc as any) as T) : null
}

// 일반 엔티티의 CRUD·페이지네이션·트랜잭션 기반이다. 변경 불가 이력은 AppendOnlyRepository를 쓴다.
export abstract class CrudRepository<Doc> implements OnModuleInit {
    // 기본 페이지 크기와 요청 상한은 독립적으로 조정할 수 있어야 한다.
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

        // 빈 필터의 countDocuments 전체 인덱스 스캔을 피한다. 추정치는 soft-deleted 행도 세는 절충이 있다.
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
        // 동시 첫 save의 createCollection 경합을 피하려고 미리 초기화한다.
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

    async withTransaction<T>(callback: (session: ClientSession) => Promise<T>): Promise<T> {
        // 드라이버가 일시 충돌은 트랜잭션 전체를, 불명확한 커밋은 커밋 단계만 재시도한다.
        const session = await this.model.startSession()
        try {
            return await session.withTransaction(callback)
        } finally {
            await session.endSession()
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
