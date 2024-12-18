import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PaymentCreateDto } from 'types'
import { PaymentsService } from './payments.service'

@Injectable()
export class PaymentsController {
    constructor(private service: PaymentsService) {}

    @MessagePattern({ cmd: 'processPayment' })
    processPayment(@Payload() createDto: PaymentCreateDto) {
        return this.service.processPayment(createDto)
    }

    @MessagePattern({ cmd: 'getPayment' })
    getPayment(@Payload() paymentId: string) {
        return this.service.getPayment(paymentId)
    }
}
