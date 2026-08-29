import type { PurchaseItemDto } from './purchase-item.dto.js'

export class CreatePurchaseRecordDto {
    idempotencyFingerprint?: string

    idempotencyKey?: string

    userId: string

    paymentId?: null | string

    purchaseItems: PurchaseItemDto[]

    totalPrice: number
}
