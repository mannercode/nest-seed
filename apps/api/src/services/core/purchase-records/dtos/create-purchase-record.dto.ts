import {
    IsArray,
    IsNotEmpty,
    IsOptional,
    IsPositive,
    IsString,
    ValidateNested
} from 'class-validator'
import { PurchaseItemDto } from './purchase-item.dto.js'

export class CreatePurchaseRecordDto {
    @IsOptional()
    @IsString()
    idempotencyFingerprint?: string

    @IsOptional()
    @IsString()
    idempotencyKey?: string

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
