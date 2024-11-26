import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument, Types } from 'mongoose'

@Schema(createSchemaOptions({}))
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
export type WatchRecordDto = SchemaJson<WatchRecord>

export type WatchRecordDocument = HydratedDocument<WatchRecord>
export const WatchRecordSchema = createMongooseSchema(WatchRecord, {})
