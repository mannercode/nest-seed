import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { PaymentCreateDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsProxy {
    constructor(@InjectClientProxy('INFRASTRUCTURES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return getProxyValue(this.service.send('processPayment', createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPayment(paymentId: string): Promise<PaymentDto> {
        return getProxyValue(this.service.send('getPayment', paymentId))
    }
}
