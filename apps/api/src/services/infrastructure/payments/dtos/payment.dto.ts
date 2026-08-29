import type { PaymentStatus } from '../models/index.js'

export class PaymentDto {
    amount: number
    createdAt: Date
    id: string
    purchaseRecordId: null | string
    status: PaymentStatus
    updatedAt: Date
    userId: string
}
