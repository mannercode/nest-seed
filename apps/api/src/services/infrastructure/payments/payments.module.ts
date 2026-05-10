import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from 'config'
import { Payment, PaymentSchema } from './models'
import { PaymentsRepository } from './payments.repository'
import { PaymentsService } from './payments.service'

@Module({
    exports: [PaymentsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Payment.name, schema: PaymentSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [PaymentsService, PaymentsRepository]
})
export class PaymentsModule {}
