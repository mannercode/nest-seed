import { Type } from 'class-transformer'
import { IsArray, IsNotEmpty, IsPositive, IsString, ValidateNested } from 'class-validator'
import { PurchaseItem } from '../models'
import { PurchaseItemDto } from './purchase.dto'

export class PurchaseCreateDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsPositive()
    @IsNotEmpty()
    totalPrice: number

    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => PurchaseItem)
    items: PurchaseItemDto[]
}
