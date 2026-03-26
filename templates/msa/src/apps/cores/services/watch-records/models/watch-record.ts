import { createMongooseSchema, MongooseSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'common'

@Schema(MongooseConfigModule.schemaOptions)
export class WatchRecord extends MongooseSchema {
    @Prop({ required: true })
    customerId: string

    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    purchaseRecordId: string

    @Prop({ required: true })
    watchDate: Date
}
export const WatchRecordSchema = createMongooseSchema(WatchRecord)
