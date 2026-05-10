import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreatePaymentDto } from './dtos'
import { Payment } from './models'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
    constructor(
        @InjectModel(Payment.name, MONGO_CONNECTION_NAME)
        readonly model: Model<Payment>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
    }

    async cancel(paymentId: string) {
        await this.deleteById(paymentId)
    }

    async create(createDto: CreatePaymentDto) {
        const payment = this.newDocument()
        payment.userId = createDto.userId
        payment.amount = createDto.amount

        await payment.save()

        return payment.toJSON()
    }
}
