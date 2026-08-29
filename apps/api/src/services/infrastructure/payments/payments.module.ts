import { Module } from '@nestjs/common'
import { PaymentsRepository } from './payments.repository.js'
import { PaymentsService } from './payments.service.js'

@Module({ exports: [PaymentsService], providers: [PaymentsService, PaymentsRepository] })
export class PaymentsModule {}
