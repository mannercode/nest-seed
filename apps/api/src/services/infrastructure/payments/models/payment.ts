import { CrudDocument } from '@mannercode/common'

export const PaymentStatus = { Cancelled: 'cancelled', Completed: 'completed' } as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export class Payment extends CrudDocument {
    amount: number

    purchaseRecordId: string

    status: PaymentStatus

    userId: string
}
