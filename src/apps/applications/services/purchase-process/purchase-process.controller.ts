import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PurchaseCreateDto } from 'cores'
import { Messages } from 'shared/config'
import { PurchaseProcessService } from './purchase-process.service'

@Controller()
export class PurchaseProcessController {
    constructor(private service: PurchaseProcessService) {}

    @MessagePattern(Messages.PurchaseProcess.processPurchase)
    processPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.processPurchase(createDto)
    }
}
