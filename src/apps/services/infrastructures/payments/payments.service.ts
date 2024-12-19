import { Injectable } from '@nestjs/common'
import { mapDocToDto, MethodLog } from 'common'
import { PaymentCreateDto, PaymentDto } from './dtos'
import { PaymentDocument } from './models'
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

    private toDto = (payment: PaymentDocument) =>
        mapDocToDto(payment, PaymentDto, ['id', 'customerId', 'amount', 'createdAt', 'updatedAt'])
}
