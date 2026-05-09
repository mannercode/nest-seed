import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'
import { Seatmap } from './seatmap'
import { TheaterLocation } from './theater-location'

@Schema(MongooseConfigModule.schemaOptions)
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

// 검색 인덱스 없음. cycle-31 substring 회귀로 prefix/exact match 인덱스가
// 활용 못 하게 되어 모두 제거. 부하 측정 후 검색 패턴이 다시 바뀌면 추가.
