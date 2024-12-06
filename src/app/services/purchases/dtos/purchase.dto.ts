import { PurchaseItem } from '../models'

export class PurchaseDto {
    id: string
    customerId: string
    totalPrice: number
    items: PurchaseItem[]
    createdAt: Date
    updatedAt: Date
}
