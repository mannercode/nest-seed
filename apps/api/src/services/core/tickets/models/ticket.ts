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

// 특정 상영의 티켓을 조회하거나 판매 현황을 집계하는 경로를 위한 복합
// 인덱스다. `deletedAt` 을 앞에 두는 이유는, soft-delete 가 모든 조회에
// `deletedAt: null` 필터를 자동으로 끼우기 때문이다. 같은 인덱스 하나로
// 이 필터까지 한 번에 커버된다.
TicketSchema.index({ deletedAt: 1, showtimeId: 1 })
// saga 단위 조회·삭제 경로용.
TicketSchema.index({ sagaId: 1 })
