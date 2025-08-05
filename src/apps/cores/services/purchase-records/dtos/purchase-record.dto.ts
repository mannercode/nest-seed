import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { PurchaseItemType } from '../models'

export class PurchaseItemDto {
    @IsEnum(PurchaseItemType)
    type: PurchaseItemType

    @IsString()
    @IsNotEmpty()
    ticketId: string
}

export class PurchaseRecordDto {
    id: string
    customerId: string
    paymentId: string
    totalPrice: number
    purchaseItems: PurchaseItemDto[]
    createdAt: Date
    updatedAt: Date
}
