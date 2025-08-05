import { Injectable } from '@nestjs/common'
import { PurchaseRecordDto } from 'apps/cores'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    processPurchase(createDto: CreatePurchaseDto): Promise<PurchaseRecordDto> {
        return this.proxy.getJson(Messages.Purchase.processPurchase, createDto)
    }
}
