import { Prop, Schema } from '@nestjs/mongoose'
import { HardDelete, MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@HardDelete()
@Schema(MongooseConfigModule.schemaOptions)
export class Showtime extends MongooseSchema {
    @Prop({ required: true })
    transactionId: Types.ObjectId

    @Prop({ required: true })
    theaterId: Types.ObjectId

    @Prop({ required: true })
    movieId: Types.ObjectId

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    endTime: Date
}
export type ShowtimeDocument = HydratedDocument<Showtime>
export const ShowtimeSchema = createMongooseSchema(Showtime)
