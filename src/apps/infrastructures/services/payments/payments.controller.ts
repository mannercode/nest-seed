import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreatePaymentDto } from './dtos'
import { PaymentsService } from './payments.service'

@Controller()
export class PaymentsController {
    constructor(private readonly service: PaymentsService) {}

    @MessagePattern(Messages.Payments.cancel)
    cancel(@Payload() paymentId: string) {
        return this.service.cancel(paymentId)
    }

    @MessagePattern(Messages.Payments.create)
    create(@Payload() createDto: CreatePaymentDto) {
        return this.service.create(createDto)
    }

    @MessagePattern(Messages.Payments.getMany)
    getMany(@Payload() paymentIds: string[]) {
        return this.service.getMany(paymentIds)
    }
}
