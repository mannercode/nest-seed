import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { PaymentCreateDto } from './dtos'
import { PaymentsService } from './payments.service'

@Controller()
export class PaymentsController {
    constructor(private service: PaymentsService) {}

    @MessagePattern(Subjects.Payments.processPayment)
    processPayment(@Payload() createDto: PaymentCreateDto) {
        return this.service.processPayment(createDto)
    }

    @MessagePattern(Subjects.Payments.getPayment)
    getPayment(@Payload() paymentId: string) {
        return this.service.getPayment(paymentId)
    }
}
