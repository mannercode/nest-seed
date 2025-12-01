import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePaymentDto, PaymentDto } from './dtos'
import { PaymentDocument } from './models'
import { PaymentsRepository } from './payments.repository'

@Injectable()
export class PaymentsService {
    constructor(private readonly repository: PaymentsRepository) {}

    async create(createDto: CreatePaymentDto) {
        const payment = await this.repository.create(createDto)

        return this.toDto(payment)
    }

    async getMany(paymentIds: string[]) {
        const payments = await this.repository.getByIds(paymentIds)

        return this.toDtos(payments)
    }

    private toDto(payment: PaymentDocument) {
        return mapDocToDto(payment, PaymentDto, [
            'id',
            'customerId',
            'amount',
            'createdAt',
            'updatedAt'
        ])
    }

    private toDtos(payments: PaymentDocument[]) {
        return payments.map((payment) => this.toDto(payment))
    }
}
