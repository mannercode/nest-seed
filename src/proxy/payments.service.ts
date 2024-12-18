import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { PaymentCreateDto, PaymentDto } from 'types'

@Injectable()
export class PaymentsService {
    constructor(@InjectClientProxy('SERVICES_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPayment(createDto: PaymentCreateDto): Promise<PaymentDto> {
        return getProxyValue(this.service.send('processPayment', createDto))
    }

    @MethodLog({ level: 'verbose' })
    getPayment(paymentId: string): Promise<PaymentDto> {
        return getProxyValue(this.service.send('getPayment', paymentId))
    }
}
