import { Prop, Schema } from '@nestjs/mongoose'
import { ModelAttributes, MongooseSchema, ObjectId, createMongooseSchema } from 'common'

@Schema()
export class WatchRecord extends MongooseSchema {
    @Prop({ type: ObjectId, required: true })
    customerId: ObjectId

    @Prop({ type: ObjectId, required: true })
    movieId: ObjectId

    @Prop({ type: ObjectId, required: true })
    purchaseId: ObjectId

    @Prop({ required: true })
    watchDate: Date
}

export const WatchRecordSchema = createMongooseSchema(WatchRecord)

export type WatchRecordCreatePayload = ModelAttributes<WatchRecord>
