import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { PaymentCreateDto, PaymentDto } from 'types'

@Injectable()
export class PaymentsService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    processPayment(createDto: PaymentCreateDto): Observable<PaymentDto> {
        return this.service.send('processPayment', createDto)
    }

    @MethodLog({ level: 'verbose' })
    getPayment(paymentId: string): Observable<PaymentDto> {
        return this.service.send('getPayment', paymentId)
    }
}
