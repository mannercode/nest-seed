import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreatePaymentDto } from './dtos'
import { Payment } from './models'

@Injectable()
export class PaymentsRepository extends CrudRepository<Payment> {
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
        payment.userId = createDto.userId
        payment.amount = createDto.amount

        await payment.save()

        return payment.toJSON()
    }
}
