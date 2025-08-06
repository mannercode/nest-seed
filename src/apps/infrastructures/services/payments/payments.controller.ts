import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreatePaymentDto } from './dtos'
import { PaymentsService } from './payments.service'

@Controller()
export class PaymentsController {
    constructor(private service: PaymentsService) {}

    @MessagePattern(Messages.Payments.createPayment)
    createPayment(@Payload() createDto: CreatePaymentDto) {
        return this.service.createPayment(createDto)
    }

    @MessagePattern(Messages.Payments.getPayments)
    getPayments(@Payload() paymentIds: string[]) {
        return this.service.getPayments(paymentIds)
    }
}
