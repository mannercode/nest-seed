import { NotFoundException } from '@nestjs/common'
import {
    Assert,
    Expect,
    MongooseSchema,
    ObjectId,
    OrderDirection,
    PaginationOption,
    PaginationResult
} from 'common'
import { differenceWith, uniqBy } from 'lodash'
import { ClientSession, HydratedDocument, Model, QueryWithHelpers } from 'mongoose'
import { MongooseException } from './exceptions'

type SeesionArg = ClientSession | undefined
const DEFAULT_TAKE_SIZE = 100

export abstract class MongooseRepository<Doc extends MongooseSchema> {
    constructor(protected model: Model<Doc>) {}

    /*
    Issue   : document.save() internally calls createCollection
    Symptom : Concurrent save() calls can cause "Collection namespace is already in use" errors.
              (more frequent in transactions)
    Solution: "await this.model.createCollection()"
    Note    : This problem mainly occurs in unit test environments with frequent initializations
    Ref     : https://mongoosejs.com/docs/api/model.html#Model.createCollection()
    */
    async onModuleInit() {
        await this.model.createCollection()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }

    async saveAll(docs: HydratedDocument<Doc>[], session: SeesionArg = undefined) {
        const { insertedCount, matchedCount, deletedCount } = await this.model.bulkSave(docs, {
            session
        })

        Assert.equals(
            docs.length,
            insertedCount + matchedCount + deletedCount,
            `The number of inserted documents should match the requested count`
        )

        return true
    }

    async findById(
        id: ObjectId,
        session: SeesionArg = undefined
    ): Promise<HydratedDocument<Doc> | null> {
        return this.model.findById(id, null, { session })
    }

    async findByIds(
        ids: ObjectId[],
        session: SeesionArg = undefined
    ): Promise<HydratedDocument<Doc>[]> {
        return this.model.find({ _id: { $in: ids } as any }, null, { session })
    }

    async getById(id: ObjectId, session: SeesionArg = undefined) {
        const doc = await this.findById(id, session)

        if (!doc) throw new NotFoundException(`Document with ID ${id} not found`)

        return doc
    }

    async getByIds(ids: ObjectId[], session: SeesionArg = undefined) {
        const uniqueIds = uniqBy(ids, (id) => id.toHexString())

        Expect.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)

        const docs = await this.model.find({ _id: { $in: uniqueIds } as any }, null, { session })

        const notFoundIds = differenceWith(uniqueIds, docs, (id, doc) => id.equals(doc._id))

        if (notFoundIds.length > 0) {
            throw new NotFoundException(
                `One or more Documents with IDs ${notFoundIds.join(', ')} not found`
            )
        }

        return docs
    }

    async deleteById(id: ObjectId, session: SeesionArg = undefined) {
        const doc = await this.getById(id, session)
        await doc.deleteOne({ session })
    }

    async deleteByIds(ids: ObjectId[], session: SeesionArg = undefined) {
        const result = await this.model.deleteMany({ _id: { $in: ids } as any }, { session })
        return result.deletedCount
    }

    async existsByIds(ids: ObjectId[], session: SeesionArg = undefined): Promise<boolean> {
        const count = await this.model.countDocuments({ _id: { $in: ids } } as any, { session })
        return count === ids.length
    }

    async findWithPagination(
        callback: (helpers: QueryWithHelpers<Array<Doc>, Doc>) => void = () => {},
        pagination: PaginationOption = {},
        session: SeesionArg = undefined
    ) {
        const take = pagination.take ?? DEFAULT_TAKE_SIZE
        const skip = pagination.skip ?? 0
        const { orderby } = pagination

        if (take <= 0) {
            throw new MongooseException(
                `Invalid pagination: 'take' must be a positive number. Received: ${take}`
            )
        }

        const helpers = this.model.find({}, null, { session })

        helpers.skip(skip)
        helpers.limit(take)

        if (orderby) {
            helpers.sort({ [orderby.name]: orderby.direction })
        } else {
            helpers.sort({ createdAt: OrderDirection.asc })
        }

        await callback(helpers)

        const items = await helpers.exec()
        const total = await this.model.countDocuments(helpers.getQuery()).exec()

        return { skip, take, total, items } as PaginationResult<HydratedDocument<Doc>>
    }

    async withTransaction<T>(
        callback: (session: ClientSession, rollback: () => void) => Promise<T>
    ) {
        let rollbackRequested = false
        const rollback = () => (rollbackRequested = true)

        const session = await this.model.startSession()

        try {
            session.startTransaction()

            const result = await callback(session, rollback)

            return result
        } catch (error) {
            rollback()
            throw error
        } finally {
            if (session.inTransaction()) {
                if (rollbackRequested) {
                    await session.abortTransaction()
                } else {
                    await session.commitTransaction()
                }
            }

            await session.endSession()
        }
    }
}
