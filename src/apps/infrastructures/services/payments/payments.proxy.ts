import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { ClientProxyConfig, Subjects } from 'shared/config'
import { PaymentCreateDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return getProxyValue(this.service.send(Subjects.Payments.processPayment, createDto))
    }
}
