import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { nullPaymentDto, PaymentCreateDto, PaymentDto } from 'types'

@Injectable()
export class PaymentsService {
    constructor() {}

    @MethodLog()
    async processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return nullPaymentDto
    }

    @MethodLog({ level: 'verbose' })
    async getPayment(paymentId: string): Promise<PaymentDto> {
        return nullPaymentDto
    }
}
