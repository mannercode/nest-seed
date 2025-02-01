import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaymentCreateDto } from './dtos'
import { PaymentsService } from './payments.service'

@Controller()
export class PaymentsController {
    constructor(private service: PaymentsService) {}

    @MessagePattern('infrastructures.payments.processPayment')
    processPayment(@Payload() createDto: PaymentCreateDto) {
        return this.service.processPayment(createDto)
    }

    @MessagePattern('infrastructures.payments.getPayment')
    getPayment(@Payload() paymentId: string) {
        return this.service.getPayment(paymentId)
    }
}
