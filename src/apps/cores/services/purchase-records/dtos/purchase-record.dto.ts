import type { PurchaseItemDto } from './purchase-item.dto'

export class PurchaseRecordDto {
    createdAt: Date
    customerId: string
    id: string
    paymentId: string
    purchaseItems: PurchaseItemDto[]
    totalPrice: number
    updatedAt: Date
}
