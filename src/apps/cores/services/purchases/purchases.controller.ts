import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PurchaseCreateDto } from './dtos'
import { PurchasesService } from './purchases.service'

@Controller()
export class PurchasesController {
    constructor(private service: PurchasesService) {}

    @MessagePattern('nestSeed.cores.purchases.createPurchase')
    createPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.createPurchase(createDto)
    }

    @MessagePattern('nestSeed.cores.purchases.getPurchase')
    getPurchase(@Payload() purchaseId: string) {
        return this.service.getPurchase(purchaseId)
    }
}
