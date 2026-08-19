import { Type } from 'class-transformer'
import {
    ArrayNotEmpty,
    IsArray,
    IsNotEmpty,
    IsPositive,
    Validate,
    ValidateNested,
    ValidatorConstraint,
    type ValidatorConstraintInterface
} from 'class-validator'
import { PurchaseItemDto, PurchaseItemType } from 'core'

@ValidatorConstraint({ name: 'isTicketPurchaseItems' })
class IsTicketPurchaseItemsConstraint implements ValidatorConstraintInterface {
    defaultMessage() {
        return 'Food purchases are not supported; only tickets can be purchased.'
    }

    validate(items: unknown) {
        return (
            !Array.isArray(items) ||
            items.every(
                (item) =>
                    typeof item === 'object' &&
                    item !== null &&
                    (item as { type?: unknown }).type === PurchaseItemType.Tickets
            )
        )
    }
}

export class CreatePurchaseDto {
    // `@IsNotEmpty()`는 빈 배열을 통과시키므로 배열 전용 검증을 쓴다.
    @ArrayNotEmpty()
    @IsArray()
    @Validate(IsTicketPurchaseItemsConstraint)
    @Type(() => PurchaseItemDto)
    @ValidateNested({ each: true })
    purchaseItems: PurchaseItemDto[]

    @IsNotEmpty()
    @IsPositive()
    totalPrice: number
}
