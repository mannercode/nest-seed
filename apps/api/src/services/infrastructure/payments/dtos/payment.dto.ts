import type { PaymentStatus } from '../models/index.js'

export class PaymentDto {
    amount: number
    createdAt: Temporal.Instant
    id: string
    purchaseRecordId: null | string
    status: PaymentStatus
    updatedAt: Temporal.Instant
    userId: string
}
