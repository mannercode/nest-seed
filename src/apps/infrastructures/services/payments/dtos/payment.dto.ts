import { BaseDto } from "common"

export class PaymentDto extends BaseDto {
    id: string
    customerId: string
    amount: number
    createdAt: Date
    updatedAt: Date
}

export const nullPaymentDto = {
    id: '',
    customerId: '',
    amount: 0,
    createdAt: new Date(0),
    updatedAt: new Date(0)
}
