import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PurchaseCreateDto } from './dtos'
import { PurchasesService } from './purchases.service'

@Injectable()
export class PurchasesController {
    constructor(private service: PurchasesService) {}

    @MessagePattern({ cmd: 'createPurchase' })
    createPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.createPurchase(createDto)
    }

    @MessagePattern({ cmd: 'getPurchase' })
    getPurchase(@Payload() purchaseId: string) {
        return this.service.getPurchase(purchaseId)
    }
}
