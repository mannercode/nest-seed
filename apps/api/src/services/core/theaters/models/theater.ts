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

// 현재 검색은 부분 문자열 정규식이라 일반 인덱스를 활용하지 못한다. 접두 일치나
// 정확 일치 검색으로 바뀌면 그때 인덱스를 다시 검토한다.
