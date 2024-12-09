import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Payment, PaymentSchema } from './models'
import { PaymentsRepository } from './payments.repository'
import { PaymentsService } from './payments.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }], 'mongo')],
    providers: [PaymentsService, PaymentsRepository],
    exports: [PaymentsService]
})
export class PaymentsModule {}
