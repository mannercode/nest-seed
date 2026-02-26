import { Injectable } from '@nestjs/common'
import { mapDocToDto } from 'common'
import { CreatePaymentDto } from './dtos'
import { PaymentDto } from './dtos'
import { Payment } from './models'
import { PaymentsRepository } from './payments.repository'

@Injectable()
export class PaymentsService {
    constructor(private readonly repository: PaymentsRepository) {}

    async cancel(paymentId: string) {
        await this.repository.cancel(paymentId)
    }

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
