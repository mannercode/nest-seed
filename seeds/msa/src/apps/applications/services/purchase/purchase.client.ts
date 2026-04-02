import { ClientProxyService } from '@mannercode/microservices'
import { InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { PurchaseRecordDto } from 'apps/cores'
import { Messages } from 'config'
import { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    processPurchase(createDto: CreatePurchaseDto): Promise<PurchaseRecordDto> {
        return this.proxy.request(Messages.Purchase.processPurchase, createDto)
    }
}
