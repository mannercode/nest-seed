import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Routes } from 'shared/config'
import { PurchaseCreateDto } from './dtos'
import { PurchasesService } from './purchases.service'

@Controller()
export class PurchasesController {
    constructor(private service: PurchasesService) {}

    @MessagePattern(Routes.Messages.Purchases.createPurchase)
    createPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.createPurchase(createDto)
    }

    @MessagePattern(Routes.Messages.Purchases.getPurchase)
    getPurchase(@Payload() purchaseId: string) {
        return this.service.getPurchase(purchaseId)
    }
}
