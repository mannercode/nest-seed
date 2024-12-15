import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PurchaseCreateDto } from 'types'
import { PurchasesService } from './purchases.service'

@Injectable()
export class PurchasesController {
    constructor(private service: PurchasesService) {}

    @MessagePattern({ cmd: 'createPurchase' })
    async createPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.createPurchase(createDto)
    }

    @MessagePattern({ cmd: 'getPurchase' })
    async getPurchase(@Payload() purchaseId: string) {
        return this.service.getPurchase(purchaseId)
    }
}
