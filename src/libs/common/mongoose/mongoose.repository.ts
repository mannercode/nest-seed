import { BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common'
import { differenceWith, uniq } from 'lodash'
import { ClientSession, HydratedDocument, Model, QueryWithHelpers } from 'mongoose'
import { CommonErrors } from '../common-errors'
import { PaginationOptionDto, PaginationResult } from '../pipes'
import { Assert, Expect } from '../validator'
import { objectId, objectIds } from './mongoose.util'

export class MongooseUpdateResult {
    modifiedCount: number
    matchedCount: number
}

type SeesionArg = ClientSession | undefined

export abstract class MongooseRepository<Doc> implements OnModuleInit {
    constructor(protected model: Model<Doc>) {}

    async onModuleInit() {
        /**
         * Issue   : document.save() internally calls createCollection
         * Symptom : Concurrent save() calls can cause "Collection namespace is already in use" errors.
         *         (more frequent in transactions)
         * Solution: "await this.model.createCollection()"
         * Note    : This problem mainly occurs in unit test environments with frequent initializations
         * Ref     : https://mongoosejs.com/docs/api/model.html#Model.createCollection()
         */
        await this.model.createCollection()
    }

    newDocument(): HydratedDocument<Doc> {
        return new this.model()
    }

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

    async findById(id: string, session: SeesionArg = undefined) {
        return this.model.findById(objectId(id), null, { session })
    }

    async findByIds(ids: string[], session: SeesionArg = undefined) {
        return this.model.find({ _id: { $in: objectIds(ids) } as any }, null, { session })
    }

    async getById(id: string, session: SeesionArg = undefined) {
        const doc = await this.findById(id, session)

        if (!doc)
            throw new NotFoundException({
                ...CommonErrors.Mongoose.DocumentNotFound,
                notFoundId: id
            })

        return doc
    }

    async getByIds(ids: string[], session: SeesionArg = undefined) {
        const uniqueIds = uniq(ids)

        Expect.equalLength(uniqueIds, ids, `Duplicate IDs detected and removed:${ids}`)

        const docs = await this.findByIds(uniqueIds, session)

        const notFoundIds = differenceWith(uniqueIds, docs, (id, doc) => id === doc.id)

        if (notFoundIds.length > 0) {
            throw new NotFoundException({
                ...CommonErrors.Mongoose.MultipleDocumentsNotFound,
                notFoundIds: notFoundIds
            })
        }

        return docs
    }

    async deleteById(id: string, session: SeesionArg = undefined) {
        const doc = await this.getById(id, session)
        await doc.deleteOne({ session })
    }

    async deleteByIds(ids: string[], session: SeesionArg = undefined) {
        const result = await this.model.deleteMany(
            { _id: { $in: objectIds(ids) } as any },
            { session }
        )
        return result.deletedCount
    }

    async existByIds(ids: string[], session: SeesionArg = undefined) {
        const count = await this.model.countDocuments({ _id: { $in: objectIds(ids) } } as any, {
            session
        })
        return count === ids.length
    }

    async findWithPagination(args: {
        callback?: (helpers: QueryWithHelpers<Array<Doc>, Doc>) => void
        pagination: PaginationOptionDto
        session?: SeesionArg
    }) {
        const { callback, pagination, session } = args

        if (!pagination.take) {
            throw new BadRequestException(CommonErrors.Pagination.TakeMissing)
        }

        const helpers = this.model.find({}, null, { session })

        let take = 0
        let skip = 0

        if (pagination.take) {
            take = pagination.take
            if (take <= 0) {
                throw new BadRequestException({ ...CommonErrors.Pagination.TakeInvalid, take })
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
