import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, ObjectId, createMongooseSchema } from 'common'

@Schema()
export class Showtime extends MongooseSchema {
    @Prop({ type: ObjectId, required: true })
    theaterId: ObjectId

    @Prop({ type: ObjectId, required: true })
    movieId: ObjectId

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    endTime: Date

    @Prop({ type: ObjectId, required: true })
    batchId: ObjectId
}

export const ShowtimeSchema = createMongooseSchema(Showtime)
