import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import type { CreatePaymentDto } from './dtos'
import type { Payment } from './models'
import type { PaymentsRepository } from './payments.repository'
import { PaymentDto } from './dtos'

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

    private toDto(payment: Payment) {
        return this.toDtos([payment])[0]
    }

    private toDtos(payments: Payment[]) {
        return payments.map((payment) =>
            mapDocToDto(payment, PaymentDto, [
                'id',
                'customerId',
                'amount',
                'createdAt',
                'updatedAt'
            ])
        )
    }
}
