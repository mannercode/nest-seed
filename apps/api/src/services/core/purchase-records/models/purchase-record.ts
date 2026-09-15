import { CrudDocument } from '@mannercode/common'

export const PurchaseItemType = { Tickets: 'tickets' } as const

export type PurchaseItemType = (typeof PurchaseItemType)[keyof typeof PurchaseItemType]

export const PurchaseRecordStatus = {
    Cancelled: 'cancelled',
    Compensating: 'compensating',
    Completed: 'completed',
    Pending: 'pending'
} as const

export type PurchaseRecordStatus = (typeof PurchaseRecordStatus)[keyof typeof PurchaseRecordStatus]

export const PurchaseEventStatus = { Pending: 'pending', Published: 'published' } as const

export type PurchaseEventStatus = (typeof PurchaseEventStatus)[keyof typeof PurchaseEventStatus]

export class PurchaseItem {
    itemId: string

    type: PurchaseItemType
}

export class PurchaseRecord extends CrudDocument {
    idempotencyKey: null | string

    idempotencyFingerprint: null | string

    idempotencyErrorStatus: null | number

    idempotencyErrorResponse: null | Record<string, unknown>

    idempotencyResponse: null | Record<string, unknown>

    userId: string

    paymentId: null | string

    purchaseEventStatus: PurchaseEventStatus

    purchaseItems: PurchaseItem[]

    totalPrice: number

    status: PurchaseRecordStatus
}
