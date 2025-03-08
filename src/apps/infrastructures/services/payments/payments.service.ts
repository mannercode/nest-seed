import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { PaymentCreateDto, PaymentDto } from './dtos'
import { PaymentDocument } from './models'
import { PaymentsRepository } from './payments.repository'

@Injectable()
export class PaymentsService {
    constructor(private repository: PaymentsRepository) {}

    async processPayment(createDto: PaymentCreateDto) {
        const payment = await this.repository.createPayment(createDto)

        return this.toDto(payment)
    }

    async getPayment(paymentId: string) {
        const payment = await this.repository.getById(paymentId)

        return this.toDto(payment)
    }

    private toDto = (payment: PaymentDocument) =>
        mapDocToDto(payment, PaymentDto, ['id', 'customerId', 'amount', 'createdAt', 'updatedAt'])
}
