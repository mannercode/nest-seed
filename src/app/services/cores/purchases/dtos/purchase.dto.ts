import { PurchaseItemType } from 'services/types'

export class PurchaseItemDto {
    type: PurchaseItemType
    ticketId: string
}

export class PurchaseDto {
    id: string
    customerId: string
    paymentId: string
    totalPrice: number
    items: PurchaseItemDto[]
    createdAt: Date
    updatedAt: Date
}