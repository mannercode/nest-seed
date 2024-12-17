import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export enum PurchaseItemType {
    ticket = 'ticket'
}

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
