import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { Seatmap } from './seatmap'
import { TheaterLocation } from './theater-location'

@Schema(MongooseConfigModule.schemaOptions)
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
    location: TheaterLocation

    @Prop({ type: Object, required: true, _id: false })
    seatmap: Seatmap
}
export type TheaterDocument = HydratedDocument<Theater>
export const TheaterSchema = createMongooseSchema(Theater)

// Creates a text index on the 'name' field to enable searching by theater name.
// 'name' 필드에 대해 텍스트 인덱스를 생성해서 극장 이름에 대한 검색을 가능하게 합니다.
TheaterSchema.index({ name: 'text' })
