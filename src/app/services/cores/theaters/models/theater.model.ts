import { Prop, Schema } from '@nestjs/mongoose'
import { LatLong, MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfig } from 'config'
import { HydratedDocument } from 'mongoose'
import { Seatmap } from './seatmap'

@Schema(MongooseConfig.schemaOptions)
export class Theater extends MongooseSchema {
    @Prop({ required: true })
    name: string

    @Prop({
        type: {
            latitude: { type: Number, required: true },
            longitude: { type: Number, required: true }
        },
        required: true,
        _id: false
    })
    latlong: LatLong

    @Prop({ type: Object, required: true })
    seatmap: Seatmap
}
export type TheaterDocument = HydratedDocument<Theater>
export const TheaterSchema = createMongooseSchema(Theater)
