import { Prop, Schema } from '@nestjs/mongoose'
import { HardDelete, MongooseSchema, createMongooseSchema } from 'common'
import { Mongoose } from 'config'
import { HydratedDocument, Types } from 'mongoose'

@HardDelete()
@Schema(Mongoose.defaultSchemaOptions)
export class Showtime extends MongooseSchema {
    @Prop({ required: true })
    theaterId: Types.ObjectId

    @Prop({ required: true })
    movieId: Types.ObjectId

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    endTime: Date

    @Prop({ required: true })
    batchId: Types.ObjectId
}
export type ShowtimeDocument = HydratedDocument<Showtime>
export const ShowtimeSchema = createMongooseSchema(Showtime)
