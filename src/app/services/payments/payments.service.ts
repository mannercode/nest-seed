import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { PaymentCreateDto } from './dtos'
import { PaymentDocument, PaymentDto } from './models'
import { PaymentsRepository } from './payments.repository'

@Injectable()
export class PaymentsService {
    constructor(private repository: PaymentsRepository) {}

    @MethodLog()
    async processPayment(createDto: PaymentCreateDto) {
        const payment = await this.repository.createPayment(createDto)

        return this.toDto(payment)
    }

    @MethodLog({ level: 'verbose' })
    async getPayment(paymentId: string) {
        const payment = await this.repository.getById(paymentId)

        return this.toDto(payment)
    }

    private toDto = (payment: PaymentDocument) => payment.toJSON<PaymentDto>()
}
