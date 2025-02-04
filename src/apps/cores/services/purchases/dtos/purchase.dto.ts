import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

import { PurchaseItemType } from '../models'

export class PurchaseItemDto {
    @IsEnum(PurchaseItemType)
    type: PurchaseItemType

    @IsString()
    @IsNotEmpty()
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

export const nullPurchase = {
    id: '',
    customerId: '',
    paymentId: '',
    totalPrice: 0,
    items: [],
    createdAt: new Date(0),
    updatedAt: new Date(0)
}
