import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { ClientProxyConfig, Messages } from 'shared/config'
import { PaymentCreateDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return this.service.getJson(Messages.Payments.processPayment, createDto)
    }
}
