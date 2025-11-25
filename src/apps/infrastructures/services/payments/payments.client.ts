import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePaymentDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    create(createDto: CreatePaymentDto): Promise<PaymentDto> {
        return this.proxy.getJson(Messages.Payments.create, createDto)
    }

    getMany(paymentIds: string[]): Promise<PaymentDto[]> {
        return this.proxy.getJson(Messages.Payments.getMany, paymentIds)
    }
}
