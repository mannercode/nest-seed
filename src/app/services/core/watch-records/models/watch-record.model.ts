import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { Mongoose } from 'config'
import { HydratedDocument, Types } from 'mongoose'

@Schema(Mongoose.defaultSchemaOptions)
export class WatchRecord extends MongooseSchema {
    @Prop({ required: true })
    customerId: Types.ObjectId

    @Prop({ required: true })
    movieId: Types.ObjectId

    @Prop({ required: true })
    purchaseId: Types.ObjectId

    @Prop({ required: true })
    watchDate: Date
}
export type WatchRecordDocument = HydratedDocument<WatchRecord>
export const WatchRecordSchema = createMongooseSchema(WatchRecord)
