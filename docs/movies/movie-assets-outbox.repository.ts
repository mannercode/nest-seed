import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { DateUtil, MongooseRepository, objectId } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { MovieAssetsOutbox, MovieAssetsOutboxStatus } from './models'
import type { ClientSession } from 'mongoose'

@Injectable()
export class MovieAssetsOutboxRepository extends MongooseRepository<MovieAssetsOutbox> {
    constructor(
        @InjectModel(MovieAssetsOutbox.name, MongooseConfigModule.connectionName)
        readonly model: Model<MovieAssetsOutbox>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async enqueueDelete(assetIds: string[], movieIds: string[], session?: ClientSession) {
        const outbox = this.newDocument()
        outbox.assetIds = assetIds
        outbox.movieIds = movieIds
        await outbox.save({ session })
        return outbox.toJSON() as MovieAssetsOutbox
    }

    async claimNext(now: Date, lockSeconds: number) {
        const lockUntil = DateUtil.add({ base: now, seconds: lockSeconds })
        const doc = await this.model
            .findOneAndUpdate(
                {
                    status: MovieAssetsOutboxStatus.Pending,
                    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }]
                },
                {
                    $set: { nextAttemptAt: lockUntil, lastAttemptedAt: now },
                    $inc: { attempts: 1 }
                },
                { new: true, sort: { createdAt: 1 } }
            )
            .exec()

        return doc ? (doc.toJSON() as MovieAssetsOutbox) : null
    }

    async claimById(id: string, now: Date, lockSeconds: number) {
        const lockUntil = DateUtil.add({ base: now, seconds: lockSeconds })
        const doc = await this.model
            .findOneAndUpdate(
                {
                    _id: objectId(id),
                    status: MovieAssetsOutboxStatus.Pending,
                    $or: [{ nextAttemptAt: null }, { nextAttemptAt: { $lte: now } }]
                },
                {
                    $set: { nextAttemptAt: lockUntil, lastAttemptedAt: now },
                    $inc: { attempts: 1 }
                },
                { new: true }
            )
            .exec()

        return doc ? (doc.toJSON() as MovieAssetsOutbox) : null
    }

    async markSent(id: string) {
        await this.model
            .updateOne(
                { _id: objectId(id) },
                {
                    $set: {
                        status: MovieAssetsOutboxStatus.Sent,
                        nextAttemptAt: null,
                        lastError: null
                    }
                }
            )
            .exec()
    }

    async markFailed(id: string, lastError: string, nextAttemptAt: Date) {
        await this.model
            .updateOne(
                { _id: objectId(id) },
                {
                    $set: {
                        status: MovieAssetsOutboxStatus.Pending,
                        lastError,
                        nextAttemptAt
                    }
                }
            )
            .exec()
    }
}
