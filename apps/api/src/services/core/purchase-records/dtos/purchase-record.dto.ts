import type { PurchaseItemDto } from './purchase-item.dto.js'

export class PurchaseRecordDto {
    createdAt: Temporal.Instant
    userId: string
    id: string
    paymentId: null | string
    purchaseItems: PurchaseItemDto[]
    totalPrice: number
    updatedAt: Temporal.Instant
}
