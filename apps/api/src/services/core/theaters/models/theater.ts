import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'
import { Seatmap } from './seatmap'
import { TheaterLocation } from './theater-location'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Theater extends CrudSchema {
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
export const TheaterSchema = createCrudSchema(Theater)

// 검색 인덱스는 두지 않는다. 부분 문자열 정규식은 접두 일치나 정확 일치
// 인덱스를 못 탄다. 검색 방식이 바뀌면 그때 다시 본다.
