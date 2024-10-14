import { Prop, Schema } from '@nestjs/mongoose'
import { DocumentId, MongooseSchema, ObjectId, createMongooseSchema } from 'common'

@Schema()
export class Showtime extends MongooseSchema {
    @Prop({ type: ObjectId, required: true })
    theaterId: DocumentId

    @Prop({ type: ObjectId, required: true })
    movieId: DocumentId

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    endTime: Date

    @Prop({ type: ObjectId, required: true })
    batchId: DocumentId
}

export const ShowtimeSchema = createMongooseSchema(Showtime)
