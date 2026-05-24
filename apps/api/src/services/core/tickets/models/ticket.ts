import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'
import { SeatPosition } from './seat-position'

export const TicketStatus = { Available: 'available', Sold: 'sold' } as const

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus]

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class Ticket extends CrudSchema {
    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    sagaId: string

    @Prop({ required: true, type: Object })
    seat: SeatPosition

    @Prop({ required: true })
    showtimeId: string

    @Prop({ enum: TicketStatus, required: true, type: String })
    status: TicketStatus

    @Prop({ required: true })
    theaterId: string
}
export const TicketSchema = createCrudSchema(Ticket)

// 특정 상영의 티켓 조회와 판매 현황 집계가 가장 자주 쓰는 접근 경로이다.
// 소프트 삭제 미들웨어가 모든 조회에 `deletedAt: null`을 추가하므로, 이 필드를 앞에 두어 같은 인덱스가 삭제 필터와 showtime 필터를 함께 처리하게 한다.
TicketSchema.index({ deletedAt: 1, showtimeId: 1 })
// showtime-creation 보상 처리에서 사가가 만든 티켓을 한 번에 찾는 경로이다.
TicketSchema.index({ sagaId: 1 })
