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

// 예매 화면이 자주 쓰는 조회 패턴인 "한 극장의 특정 시간대 상영" 을
// 위한 복합 인덱스다. 이 스키마는 hard-delete 라서 다른 도메인과 달리
// `deletedAt` 필터가 prefix 에 끼지 않는다.
ShowtimeSchema.index({ theaterId: 1, startTime: 1 })
// saga 단위로 한 번에 지우는 경로용.
ShowtimeSchema.index({ sagaId: 1 })
