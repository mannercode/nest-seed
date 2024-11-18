import { Prop, Schema } from '@nestjs/mongoose'
import { LatLong, ModelAttributes, MongooseSchema, createMongooseSchema } from 'common'
import { Seatmap } from './seatmap.model'
import * as mongooseDelete from 'mongoose-delete'

@Schema()
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

export const TheaterSchema = createMongooseSchema(Theater)
TheaterSchema.plugin(mongooseDelete, { deletedAt: true, overrideMethods: 'all' })

export type TheaterCreatePayload = ModelAttributes<Theater>
export type TheaterUpdatePayload = Partial<ModelAttributes<Theater>>
