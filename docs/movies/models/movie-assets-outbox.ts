import { Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, MongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

export enum MovieAssetsOutboxStatus {
    Pending = 'pending',
    Sent = 'sent'
}

@Schema(MongooseConfigModule.schemaOptions)
export class MovieAssetsOutbox extends MongooseSchema {
    @Prop({ required: true, type: [String] })
    assetIds: string[]

    @Prop({ required: true, type: [String] })
    movieIds: string[]

    @Prop({
        required: true,
        type: String,
        enum: MovieAssetsOutboxStatus,
        default: MovieAssetsOutboxStatus.Pending
    })
    status: MovieAssetsOutboxStatus

    @Prop({ required: true, default: 0 })
    attempts: number

    @Prop({ type: Date, default: null })
    lastAttemptedAt: Date | null

    @Prop({ type: Date, default: null })
    nextAttemptAt: Date | null

    @Prop({ type: String, default: null })
    lastError: string | null
}

export type MovieAssetsOutboxDocument = HydratedDocument<MovieAssetsOutbox>
export const MovieAssetsOutboxSchema = createMongooseSchema(MovieAssetsOutbox)
MovieAssetsOutboxSchema.index({ status: 1, nextAttemptAt: 1 })
