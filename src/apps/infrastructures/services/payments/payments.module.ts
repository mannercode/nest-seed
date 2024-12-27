import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from 'shared/config'
import { Payment, PaymentSchema } from './models'
import { PaymentsController } from './payments.controller'
import { PaymentsRepository } from './payments.repository'
import { PaymentsService } from './payments.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Payment.name, schema: PaymentSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [PaymentsService, PaymentsRepository],
    controllers: [PaymentsController]
})
export class PaymentsModule {}
