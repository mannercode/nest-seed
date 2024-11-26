import { Prop, Schema } from '@nestjs/mongoose'
import {
    LatLong,
    MongooseSchema,
    SchemaJson,
    createMongooseSchema,
    createSchemaOptions
} from 'common'
import { HydratedDocument } from 'mongoose'
import { Seatmap } from './seatmap.model'

@Schema(createSchemaOptions({}))
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
export type TheaterDto = SchemaJson<Theater>

export type TheaterDocument = HydratedDocument<Theater>
export const TheaterSchema = createMongooseSchema(Theater, {})
