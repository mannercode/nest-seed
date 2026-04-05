import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { PurchaseItemType } from '../models'

export class PurchaseItemDto {
    @IsNotEmpty()
    @IsString()
    itemId: string

    @IsEnum(PurchaseItemType)
    type: PurchaseItemType
}
