import { BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common'
import {
    Assert,
    Expect,
    MethodLog,
    objectId,
    objectIds,
    PaginationOption,
    PaginationResult
} from 'common'
import { differenceWith, uniq } from 'lodash'
import { ClientSession, HydratedDocument, Model, QueryWithHelpers } from 'mongoose'

export class MongooseUpdateResult {
    modifiedCount: number
    matchedCount: number
}

type SeesionArg = ClientSession | undefined

export abstract class MongooseRepository<Doc> implements OnModuleInit {
    constructor(protected model: Model<Doc>) {}

    async onModuleInit() {
        /*
        Issue   : document.save() internally calls createCollection
        Symptom : Concurrent save() calls can cause "Collection namespace is already in use" errors.
                (more frequent in transactions)
        Solution: "await this.model.createCollection()"
        Note    : This problem mainly occurs in unit test environments with frequent initializations
        Ref     : https://mongoosejs.com/docs/api/model.html#Model.createCollection()
        */
        await this.model.createCollection()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }

    @MethodLog({ excludeArgs: ['session'] })
    async saveMany(docs: HydratedDocument<Doc>[], session: SeesionArg = undefined) {
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

    @MethodLog({ level: 'verbose', excludeArgs: ['session'] })
    async findById(id: string, session: SeesionArg = undefined) {
        return this.model.findById(objectId(id), null, { session })
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['session'] })
    async findByIds(ids: string[], session: SeesionArg = undefined) {
        return this.model.find({ _id: { $in: objectIds(ids) } as any }, null, { session })
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['session'] })
    async getById(id: string, session: SeesionArg = undefined) {
        const doc = await this.findById(id, session)

        if (!doc)
            throw new NotFoundException({
                code: 'ERR_DOCUMENT_NOT_FOUND',
                message: `Document not found`,
                notFoundId: id
            })

        return doc
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['session'] })
    async getByIds(ids: string[], session: SeesionArg = undefined) {
        const uniqueIds = uniq(ids)

        Expect.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)

        const docs = await this.findByIds(uniqueIds, session)

        const notFoundIds = differenceWith(uniqueIds, docs, (id, doc) => id === doc.id)

        if (notFoundIds.length > 0) {
            throw new NotFoundException({
                code: 'ERR_DOCUMENT_NOT_FOUND',
                message: `One or more Documents with IDs not found`,
                notFoundIds: notFoundIds
            })
        }

        return docs
    }

    @MethodLog({ excludeArgs: ['session'] })
    async deleteById(id: string, session: SeesionArg = undefined) {
        const doc = await this.getById(id, session)
        await doc.deleteOne({ session })
    }

    @MethodLog({ excludeArgs: ['session'] })
    async deleteByIds(ids: string[], session: SeesionArg = undefined) {
        const result = await this.model.deleteMany(
            { _id: { $in: objectIds(ids) } as any },
            { session }
        )
        return result.deletedCount
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['session'] })
    async existByIds(ids: string[], session: SeesionArg = undefined) {
        const count = await this.model.countDocuments({ _id: { $in: objectIds(ids) } } as any, {
            session
        })
        return count === ids.length
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['session', 'callback'] })
    async findWithPagination(args: {
        callback?: (helpers: QueryWithHelpers<Array<Doc>, Doc>) => void
        pagination: PaginationOption
        session?: SeesionArg
    }) {
        const { callback, pagination, session } = args

        if (!pagination.take) {
            throw new BadRequestException({
                code: 'ERR_INVALID_PAGINATION',
                message: `'take' must be specified.`
            })
        }

        const helpers = this.model.find({}, null, { session })

        let take = 0
        let skip = 0

        if (pagination.take) {
            take = pagination.take
            if (take <= 0) {
                throw new BadRequestException({
                    code: 'ERR_INVALID_PAGINATION',
                    message: `'take' must be a positive number`,
                    take
                })
            }
            helpers.limit(take)
        }

        if (pagination.skip) {
            skip = pagination.skip
            helpers.skip(skip)
        }

        if (pagination.orderby) {
            const { name, direction } = pagination.orderby
            helpers.sort({ [name]: direction })
        }

        if (callback) {
            await callback(helpers)
        }

        const items = await helpers.exec()
        const total = await this.model.countDocuments(helpers.getQuery()).exec()

        return { skip, take, total, items } as PaginationResult<HydratedDocument<Doc>>
    }

    @MethodLog({ level: 'verbose', excludeArgs: ['callback'] })
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
