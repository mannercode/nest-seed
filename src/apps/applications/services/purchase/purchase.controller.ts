import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreatePurchaseDto } from './dtos'
import { PurchaseService } from './purchase.service'

@Controller()
export class PurchaseController {
    constructor(private readonly service: PurchaseService) {}

    @MessagePattern(Messages.Purchase.processPurchase)
    processPurchase(@Payload() createDto: CreatePurchaseDto) {
        return this.service.processPurchase(createDto)
    }
}
