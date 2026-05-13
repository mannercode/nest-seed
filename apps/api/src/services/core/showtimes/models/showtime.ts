import { createCrudSchema, HardDelete, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@HardDelete()
@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Showtime extends CrudSchema {
    @Prop({ required: true })
    endTime: Date

    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    sagaId: string

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    theaterId: string
}
export const ShowtimeSchema = createCrudSchema(Showtime)

// 예매 화면은 "한 극장의 특정 시간대 상영"을 반복해서 조회합니다. 이 스키마는
// 완전 삭제를 쓰므로 다른 도메인과 달리 `deletedAt` 필터가 붙지 않습니다.
// theaterId와 startTime만으로 접근 경로를 만듭니다.
ShowtimeSchema.index({ theaterId: 1, startTime: 1 })
// showtime-creation 보상 처리에서 사가가 만든 상영을 한 번에 찾는 경로입니다.
ShowtimeSchema.index({ sagaId: 1 })
