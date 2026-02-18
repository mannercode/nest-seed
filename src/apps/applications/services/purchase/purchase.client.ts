import type { PurchaseRecordDto } from 'apps/cores'
import type { ClientProxyService } from 'common'
import { Injectable } from '@nestjs/common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import type { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    processPurchase(createDto: CreatePurchaseDto): Promise<PurchaseRecordDto> {
        return this.proxy.request(Messages.Purchase.processPurchase, createDto)
    }
}
