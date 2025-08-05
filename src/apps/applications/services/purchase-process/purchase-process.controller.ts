import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { CreatePurchaseRecordDto } from 'apps/cores'
import { Messages } from 'shared'
import { PurchaseProcessService } from './purchase-process.service'

@Controller()
export class PurchaseProcessController {
    constructor(private service: PurchaseProcessService) {}

    @MessagePattern(Messages.PurchaseProcess.processPurchase)
    processPurchase(@Payload() createDto: CreatePurchaseRecordDto) {
        return this.service.processPurchase(createDto)
    }
}
