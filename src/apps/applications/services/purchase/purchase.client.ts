import { ClientProxyService } from '@mannercode/nestlib-microservice'
import { InjectClientProxy } from '@mannercode/nestlib-microservice'
import { Injectable } from '@nestjs/common'
import { PurchaseRecordDto } from 'apps/cores'
import { Messages } from 'shared'
import { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    processPurchase(createDto: CreatePurchaseDto): Promise<PurchaseRecordDto> {
        return this.proxy.request(Messages.Purchase.processPurchase, createDto)
    }
}
