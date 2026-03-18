import { createMongooseSchema, MongooseSchema } from '@mannercode/nestlib-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { Seatmap } from './seatmap'
import { TheaterLocation } from './theater-location'

@Schema(MongooseConfigModule.schemaOptions)
export class Theater extends MongooseSchema {
    @Prop({
        _id: false,
        required: true,
        type: {
            latitude: { required: true, type: Number },
            longitude: { required: true, type: Number }
        }
    })
    location: TheaterLocation

    @Prop({ required: true })
    name: string

    @Prop({ _id: false, required: true, type: Object })
    seatmap: Seatmap
}
export const TheaterSchema = createMongooseSchema(Theater)

// Creates a text index on the 'name' field to enable searching by theater name.
// 'name' 필드에 대해 텍스트 인덱스를 생성해서 극장 이름에 대한 검색을 가능하게 합니다.
TheaterSchema.index({ name: 'text' })
