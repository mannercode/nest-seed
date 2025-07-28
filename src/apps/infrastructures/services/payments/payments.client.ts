import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePaymentDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    processPayment(createDto: CreatePaymentDto): Promise<PaymentDto> {
        return this.proxy.getJson(Messages.Payments.processPayment, createDto)
    }

    getPayments(paymentIds: string[]): Promise<PaymentDto[]> {
        return this.proxy.getJson(Messages.Payments.getPayments, paymentIds)
    }
}
