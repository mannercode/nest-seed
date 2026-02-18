import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { PurchaseItemType } from '../models'

export class PurchaseItemDto {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}

export class PurchaseRecordDto {
    createdAt: Date
    customerId: string
    id: string
    paymentId: string
    purchaseItems: PurchaseItemDto[]
    totalPrice: number
    updatedAt: Date
}
