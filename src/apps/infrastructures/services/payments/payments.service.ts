import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePaymentDto, PaymentDto } from './dtos'
import { PaymentDocument } from './models'
import { PaymentsRepository } from './payments.repository'

@Injectable()
export class PaymentsService {
    constructor(private repository: PaymentsRepository) {}

    async createPayment(createDto: CreatePaymentDto) {
        const payment = await this.repository.createPayment(createDto)

        return this.toDto(payment)
    }

    async getPayments(paymentIds: string[]) {
        const payments = await this.repository.getByIds(paymentIds)

        return this.toDtos(payments)
    }

    private toDto = (payment: PaymentDocument) =>
        mapDocToDto(payment, PaymentDto, ['id', 'customerId', 'amount', 'createdAt', 'updatedAt'])

    private toDtos = (payments: PaymentDocument[]) => payments.map((payment) => this.toDto(payment))
}
