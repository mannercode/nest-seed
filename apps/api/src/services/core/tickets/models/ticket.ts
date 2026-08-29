import { CrudDocument } from '@mannercode/common'
import type { SeatPosition } from './seat-position.js'

export const TicketStatus = { Available: 'available', Sold: 'sold' } as const

export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus]

export class Ticket extends CrudDocument {
    movieId: string

    purchaseRecordId: null | string

    sagaId: string

    seat: SeatPosition

    showtimeId: string

    status: TicketStatus

    theaterId: string
}
