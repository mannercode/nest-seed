import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { PurchaseCreateDto } from 'types'
import { PurchaseProcessService } from './purchase-process.service'

@Injectable()
export class PurchaseProcessController {
    constructor(private service: PurchaseProcessService) {}

    @MessagePattern({ cmd: 'processPurchase' })
    async processPurchase(@Payload() createDto: PurchaseCreateDto) {
        return this.service.processPurchase(createDto)
    }
}
