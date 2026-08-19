import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    ValidateNested
} from 'class-validator'
import { PurchaseItemDto } from './purchase-item.dto'

export class CreatePurchaseRecordDto {
    @IsNotEmpty()
    @IsString()
    userId: string

    @IsOptional()
    @IsString()
    paymentId?: null | string

    @IsArray()
    @IsNotEmpty()
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
