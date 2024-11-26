import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument, Types } from 'mongoose'

const omits = ['batchId'] as const

@Schema(createSchemaOptions({ timestamps: false, json: { omits } }))
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
export type ShowtimeDto = SchemaJson<Showtime, typeof omits>

export type ShowtimeDocument = HydratedDocument<Showtime>
export const ShowtimeSchema = createMongooseSchema(Showtime, {})
