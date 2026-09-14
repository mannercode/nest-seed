import { BadRequestException, NotFoundException, type OnModuleInit } from '@nestjs/common'
import {
    ObjectId,
    type Collection,
    type Document,
    type Filter,
    type IndexDescription,
    type MongoClient
} from 'mongodb'
import type { PaginationDto, PaginationResult } from '../pagination/index.js'
import type { TransactionContext } from '../transaction.js'
import type { CrudDocument, StoredDocument } from './mongo.document.js'
import { Assume, DateUtil, defaultTo, differenceWith, Require, uniq } from '../utils/index.js'
import { MongoErrors } from './errors.js'
import { MongoTransactionRepository } from './mongo-transaction.repository.js'
import type { MongoConnection } from './mongo-connection.js'
import type { MongoReadOptions, MongoWriteOptions } from './mongo.types.js'
import {
    mongoToPublic,
    encodeMongoDocument,
    objectId,
    objectIds,
    withoutPublicId
} from './mongo.util.js'

type TransactionArg = TransactionContext | undefined
const initializationByClient = new WeakMap<MongoClient, Map<string, Promise<void>>>()

export type CrudRepositoryOptions = {
    hardDelete?: boolean
    indexes?: IndexDescription[]
    projection?: Document
}

export abstract class CrudRepository<Doc extends CrudDocument>
    extends MongoTransactionRepository
    implements OnModuleInit
{
    readonly collection: Collection
    protected readonly hardDelete: boolean
    private readonly indexes: IndexDescription[]
    protected readonly projection: Document | undefined

    constructor(
        connection: MongoConnection,
        collectionName: string,
        protected readonly defaultSize: number,
        protected readonly maxSize: number,
        options: CrudRepositoryOptions = {}
    ) {
        super(connection)
        this.collection = connection.db.collection(collectionName)
        this.hardDelete = options.hardDelete ?? false
        this.projection = options.projection
        this.indexes = [
            ...(this.hardDelete ? [] : [{ key: { deletedAt: 1 } }]),
            ...(options.indexes ?? [])
        ]
    }

    async findDocument(filter: Document, options: MongoReadOptions = {}) {
        const { transaction, ...readOptions } = options
        return this.collection.findOne(filter, {
            ...readOptions,
            session: this.getSession(transaction)
        })
    }

    async findDocuments(filter: Document, options: MongoReadOptions = {}) {
        const { transaction, ...readOptions } = options
        return this.collection
            .find(filter, { ...readOptions, session: this.getSession(transaction) })
            .toArray()
    }

    async findAndUpdateDocument(
        filter: Document,
        update: Document,
        options: MongoWriteOptions = {}
    ) {
        const { transaction, ...writeOptions } = options
        return this.collection.findOneAndUpdate(filter, update, {
            ...writeOptions,
            session: this.getSession(transaction)
        })
    }

    async updateDocument(filter: Document, update: Document, options: MongoWriteOptions = {}) {
        const { transaction, ...writeOptions } = options
        return this.collection.updateOne(filter, update, {
            ...writeOptions,
            session: this.getSession(transaction)
        })
    }

    async updateDocuments(filter: Document, update: Document, options: MongoWriteOptions = {}) {
        const { transaction, ...writeOptions } = options
        return this.collection.updateMany(filter, update, {
            ...writeOptions,
            session: this.getSession(transaction)
        })
    }

    async countDocuments(filter: Document) {
        return this.collection.countDocuments(filter)
    }

    async distinctValues<T>(field: string, filter: Document) {
        return (await this.collection.distinct(field, filter)) as T[]
    }

    async aggregateDocuments<T extends Document>(pipeline: Document[]): Promise<T[]> {
        return this.collection.aggregate<T>(pipeline).toArray()
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

    async deleteById(id: string, transaction: TransactionArg = undefined) {
        const session = this.getSession(transaction)
        const filter = this.activeFilter({ _id: objectId(id) })
        const result = this.hardDelete
            ? await this.collection.findOneAndDelete(filter, { session })
            : await this.collection.findOneAndUpdate(
                  filter,
                  this.timestamped({ $set: { deletedAt: DateUtil.now() } }),
                  { returnDocument: 'before', session }
              )

        if (!result) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
    }

    async deleteByIds(ids: string[], transaction: TransactionArg = undefined) {
        const session = this.getSession(transaction)
        const filter = this.activeFilter({ _id: { $in: objectIds(ids) } })
        if (this.hardDelete) {
            const { deletedCount } = await this.collection.deleteMany(filter, { session })
            return { deletedCount }
        }

        const { modifiedCount } = await this.collection.updateMany(
            filter,
            this.timestamped({ $set: { deletedAt: DateUtil.now() } }),
            { session }
        )
        return { deletedCount: modifiedCount }
    }

    async allExist(
        ids: string[],
        transaction: TransactionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const uniqueIds = uniq(ids)
        if (uniqueIds.length === 0) return true
        const session = this.getSession(transaction)
        const count = await this.collection.countDocuments(
            this.activeFilter({ _id: { $in: objectIds(uniqueIds) } }),
            { session, signal }
        )
        return count === uniqueIds.length
    }

    async findById(id: string, transaction: TransactionArg = undefined) {
        const doc = await this.collection.findOne(this.activeFilter({ _id: objectId(id) }), {
            projection: this.projection,
            session: this.getSession(transaction)
        })
        return doc ? this.toDomainDocument(doc) : null
    }

    async findByIds(
        ids: string[],
        transaction: TransactionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<Doc[]> {
        const docs = await this.collection
            .find(this.activeFilter({ _id: { $in: objectIds(ids) } }), {
                projection: this.projection,
                session: this.getSession(transaction),
                signal
            })
            .toArray()
        return docs.map((doc) => this.toDomainDocument(doc))
    }

    async findWithPagination(args: {
        filter?: Filter<Document>
        pagination: PaginationDto
        transaction?: TransactionArg
    }) {
        const { filter = {}, pagination, transaction } = args
        const size = defaultTo(pagination.size, this.defaultSize)
        const page = defaultTo(pagination.page, 1)

        if (size <= 0) throw new BadRequestException(MongoErrors.SizeInvalid(size))
        if (this.maxSize < size) {
            throw new BadRequestException(MongoErrors.MaxSizeExceeded(this.maxSize, size))
        }

        const activeFilter = this.activeFilter(filter)
        const session = this.getSession(transaction)
        const cursor = this.collection
            .find(activeFilter, { projection: this.projection, session })
            .limit(size)
            .skip((page - 1) * size)

        if (pagination.orderby) {
            const { direction, name } = pagination.orderby
            cursor.sort({ [name]: direction })
        }

        const [rawItems, total] = await Promise.all([
            cursor.toArray(),
            this.collection.countDocuments(activeFilter, { session })
        ])

        return {
            items: rawItems.map((doc) => this.toDomainDocument(doc)),
            page,
            size,
            total
        } as PaginationResult<Doc>
    }

    async getById(id: string, transaction: TransactionArg = undefined) {
        const doc = await this.findById(id, transaction)
        if (!doc) throw new NotFoundException(MongoErrors.DocumentNotFound(id))
        return doc
    }

    async getByIds(
        ids: string[],
        transaction: TransactionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const uniqueIds = uniq(ids)
        Assume.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)
        const docs = await this.findByIds(uniqueIds, transaction, signal)
        const notFoundIds = differenceWith(uniqueIds, docs, (id, doc) => id === doc.id)
        if (notFoundIds.length > 0) {
            throw new NotFoundException(MongoErrors.MultipleDocumentsNotFound(notFoundIds))
        }
        return docs
    }

    protected newDocument(): Doc & StoredDocument<Doc> {
        const now = DateUtil.now()
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
        transaction: TransactionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<Doc> {
        signal?.throwIfAborted()
        // Driver 7.5의 공개 write option 타입에는 signal이 빠져 있지만 내부 operation은 이를
        // 소비한다. 옵션 객체로 전달해 Restate 시도 취소가 시작된 쓰기에도 이어지게 한다.
        const options = { session: this.getSession(transaction), signal }
        await this.collection.insertOne(withoutPublicId(doc), options)
        return doc
    }

    protected async insertMany(
        docs: Array<Doc & StoredDocument<Doc>>,
        transaction: TransactionArg = undefined,
        signal: AbortSignal | undefined = undefined
    ): Promise<void> {
        if (docs.length === 0) return
        signal?.throwIfAborted()
        const options = { session: this.getSession(transaction), signal }
        const result = await this.collection.insertMany(
            docs.map((doc) => withoutPublicId(doc)),
            options
        )
        Require.equals(
            docs.length,
            result.insertedCount,
            'The number of inserted documents should match the requested count'
        )
    }

    protected activeFilter(filter: Filter<Document>): Filter<Document> {
        const encoded = encodeMongoDocument(filter)
        if (this.hardDelete) return encoded
        return { $and: [encoded, { deletedAt: null }] }
    }

    protected timestamped(update: Document) {
        return encodeMongoDocument({
            ...update,
            $inc: { ...update.$inc, __v: 1 },
            $set: { ...update.$set, updatedAt: DateUtil.now() }
        })
    }

    protected toDomainDocument(doc: Document & { _id: ObjectId }): Doc {
        return mongoToPublic<Doc>(doc)
    }
}
