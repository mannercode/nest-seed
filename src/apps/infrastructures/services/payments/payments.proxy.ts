import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { Messages } from 'shared/config'
import { PaymentCreateDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return getProxyValue(this.service.send(Messages.Payments.processPayment, createDto))
    }
}
