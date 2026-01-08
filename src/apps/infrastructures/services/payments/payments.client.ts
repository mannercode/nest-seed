import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePaymentDto, PaymentDto } from './dtos'

@Injectable()
export class PaymentsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreatePaymentDto): Promise<PaymentDto> {
        return this.proxy.request(Messages.Payments.create, createDto)
    }

    getMany(paymentIds: string[]): Promise<PaymentDto[]> {
        return this.proxy.request(Messages.Payments.getMany, paymentIds)
    }

    deleteMany(paymentIds: string[]): Promise<Record<string, never>> {
        return this.proxy.request(Messages.Payments.deleteMany, paymentIds)
    }
}
