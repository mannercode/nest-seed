import { MongooseRepository } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreatePaymentDto } from './dtos'
import { Payment } from './models'

@Injectable()
export class PaymentsRepository extends MongooseRepository<Payment> {
    constructor(
        @InjectModel(Payment.name, MongooseConfigModule.connectionName)
        readonly model: Model<Payment>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async cancel(paymentId: string) {
        await this.deleteById(paymentId)
    }

    async create(createDto: CreatePaymentDto) {
        const payment = this.newDocument()
        payment.customerId = createDto.customerId
        payment.amount = createDto.amount

        await payment.save()

        return payment.toJSON()
    }
}
