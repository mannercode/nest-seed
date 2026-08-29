import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { PurchaseItemType } from '../models/index.js'

export class PurchaseItemDto {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}
