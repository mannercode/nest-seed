import type { PaymentStatus } from '../models'

export class PaymentDto {
    amount: number
    createdAt: Date
    id: string
    status: PaymentStatus
    updatedAt: Date
    userId: string
}
