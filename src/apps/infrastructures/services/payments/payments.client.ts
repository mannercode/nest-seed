import { Injectable } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePaymentDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    cancel(paymentId: string): Promise<void> {
        return this.proxy.request(Messages.Payments.cancel, paymentId)
    }

    create(createDto: CreatePaymentDto): Promise<PaymentDto> {
        return this.proxy.request(Messages.Payments.create, createDto)
    }

    getMany(paymentIds: string[]): Promise<PaymentDto[]> {
        return this.proxy.request(Messages.Payments.getMany, paymentIds)
    }
}
