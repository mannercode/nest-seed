import { BadRequestException, NotFoundException, type OnModuleInit } from '@nestjs/common'
import {
    ObjectId,
    type ClientSession,
    type Collection,
    type Document,
    type Filter,
    type IndexDescription,
    type MongoClient,
    type UpdateFilter
} from 'mongodb'
import type { PaginationDto, PaginationResult } from '../pagination/index.js'
import type { CrudDocument, StoredDocument } from './mongo.document.js'
import { Assume, defaultTo, differenceWith, Require, uniq } from '../utils/index.js'
import { MongoErrors } from './errors.js'
import {
    mongoArrayToPublic,
    mongoToPublic,
    objectId,
    objectIds,
    withoutPublicId
} from './mongo.util.js'

type SessionArg = ClientSession | undefined
type WithTransactionOptions = NonNullable<Parameters<ClientSession['withTransaction']>[1]>
const initializationByClient = new WeakMap<MongoClient, Map<string, Promise<void>>>()

export type CrudRepositoryOptions = {
    hardDelete?: boolean
    indexes?: IndexDescription[]
    projection?: Document
}

export abstract class CrudRepository<Doc extends CrudDocument> implements OnModuleInit {
    protected readonly hardDelete: boolean
    private readonly indexes: IndexDescription[]
    protected readonly projection: Document | undefined

    constructor(
        readonly collection: Collection,
        protected readonly client: MongoClient,
        protected readonly defaultSize: number,
        protected readonly maxSize: number,
        options: CrudRepositoryOptions = {}
    ) {
        this.hardDelete = options.hardDelete ?? false
        this.projection = options.projection
        this.indexes = [
            ...(this.hardDelete ? [] : [{ key: { deletedAt: 1 } }]),
            ...(options.indexes ?? [])
        ]
    }

    async onModuleInit() {
        if (this.indexes.length === 0) return

        let initializations = initializationByClient.get(this.client)
        if (!initializations) {
            initializations = new Map()
            initializationByClient.set(this.client, initializations)
        }

        const key = this.collection.namespace
        let initialization = initializations.get(key)
        if (!initialization) {
            initialization = this.collection.createIndexes(this.indexes).then(() => undefined)
            initializations.set(key, initialization)
        }

        try {
            await initialization
        } catch (error) {
            initializations.delete(key)
            throw error
        }
    }

    async deleteById(id: string, session: SessionArg = undefined) {
        const filter = this.activeFilter({ _id: objectId(id) })
        const result = this.hardDelete
            ? await this.collection.findOneAndDelete(filter, { session })
            : await this.collection.findOneAndUpdate(
                  filter,
                  { $inc: { __v: 1 }, $set: { deletedAt: new Date(), updatedAt: new Date() } },
                  { returnDocument: 'before', session }
              )

        if (!result) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
    }

    async deleteByIds(ids: string[], session: SessionArg = undefined) {
        const filter = this.activeFilter({ _id: { $in: objectIds(ids) } })
        if (this.hardDelete) {
            const { deletedCount } = await this.collection.deleteMany(filter, { session })
            return { deletedCount }
        }

        const { modifiedCount } = await this.collection.updateMany(
            filter,
            { $inc: { __v: 1 }, $set: { deletedAt: new Date(), updatedAt: new Date() } },
            { session }
        )
        return { deletedCount: modifiedCount }
    }

    async allExist(
        ids: string[],
        session: SessionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const uniqueIds = uniq(ids)
        if (uniqueIds.length === 0) return true
        const count = await this.collection.countDocuments(
            this.activeFilter({ _id: { $in: objectIds(uniqueIds) } }),
            { session, signal }
        )
        return count === uniqueIds.length
    }

    async findById(id: string, session: SessionArg = undefined) {
        const doc = await this.collection.findOne(this.activeFilter({ _id: objectId(id) }), {
            projection: this.projection,
            session
        })
        return mongoToPublic<Doc>(doc)
    }

    async findByIds(
        ids: string[],
        session: SessionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<Doc[]> {
        const docs = await this.collection
            .find(this.activeFilter({ _id: { $in: objectIds(ids) } }), {
                projection: this.projection,
                session,
                signal
            })
            .toArray()
        return mongoArrayToPublic<Doc>(docs)
    }

    async findWithPagination(args: {
        filter?: Filter<Document>
        pagination: PaginationDto
        session?: SessionArg
    }) {
        const { filter = {}, pagination, session } = args
        const size = defaultTo(pagination.size, this.defaultSize)
        const page = defaultTo(pagination.page, 1)

        if (size <= 0) throw new BadRequestException(MongoErrors.SizeInvalid(size))
        if (this.maxSize < size) {
            throw new BadRequestException(MongoErrors.MaxSizeExceeded(this.maxSize, size))
        }

        const cursor = this.collection
            .find(this.activeFilter(filter), { projection: this.projection, session })
            .limit(size)
            .skip((page - 1) * size)

        if (pagination.orderby) {
            const { direction, name } = pagination.orderby
            cursor.sort({ [name]: direction })
        }

        const filterIsEmpty = Object.keys(filter).length === 0
        const [rawItems, total] = await Promise.all([
            cursor.toArray(),
            filterIsEmpty
                ? this.collection.estimatedDocumentCount()
                : this.collection.countDocuments(this.activeFilter(filter), { session })
        ])

        return {
            items: mongoArrayToPublic<Doc>(rawItems),
            page,
            size,
            total
        } as PaginationResult<Doc>
    }

    async getById(id: string, session: SessionArg = undefined) {
        const doc = await this.findById(id, session)
        if (!doc) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
        return doc
    }

    async getByIds(
        ids: string[],
        session: SessionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const uniqueIds = uniq(ids)
        Assume.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)
        const docs = await this.findByIds(uniqueIds, session, signal)
        const notFoundIds = differenceWith(uniqueIds, docs, (id, doc) => id === doc.id)
        if (notFoundIds.length > 0) {
            throw new NotFoundException(MongoErrors.MultipleDocumentsNotFound(notFoundIds))
        }
        return docs
    }

    async withTransaction<T>(
        callback: (session: ClientSession) => Promise<T>,
        options: WithTransactionOptions = {}
    ): Promise<T> {
        const session = this.client.startSession()
        try {
            return await session.withTransaction(callback, options)
        } finally {
            await session.endSession()
        }
    }

    protected newDocument(): Doc & StoredDocument<Doc> {
        const now = new Date()
        const _id = new ObjectId()
        return {
            __v: 0,
            _id,
            ...(this.hardDelete ? {} : { deletedAt: null }),
            createdAt: now,
            id: _id.toHexString(),
            updatedAt: now
        } as unknown as Doc & StoredDocument<Doc>
    }

    protected async insertOne(
        doc: Doc & StoredDocument<Doc>,
        session: SessionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<Doc> {
        signal?.throwIfAborted()
        // Driver 7.5의 공개 write option 타입에는 signal이 빠져 있지만 내부 operation은 이를
        // 소비한다. 옵션 객체로 전달해 Restate 시도 취소가 시작된 쓰기에도 이어지게 한다.
        const options = { session, signal }
        await this.collection.insertOne(withoutPublicId(doc), options)
        return doc
    }

    protected async insertMany(
        docs: Array<Doc & StoredDocument<Doc>>,
        session: SessionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<void> {
        if (docs.length === 0) return
        signal?.throwIfAborted()
        const options = { session, signal }
        const result = await this.collection.insertMany(
            docs.map((doc) => withoutPublicId(doc) as Document),
            options
        )
        Require.equals(
            docs.length,
            result.insertedCount,
            'The number of inserted documents should match the requested count'
        )
    }

    protected activeFilter(filter: Filter<Document>): Filter<Document> {
        if (this.hardDelete) return filter
        return { $and: [filter, { deletedAt: null }] }
    }

    protected timestamped(update: Document) {
        return {
            ...update,
            $inc: { ...update.$inc, __v: 1 },
            $set: { ...update.$set, updatedAt: new Date() }
        } as UpdateFilter<Document>
    }
}
