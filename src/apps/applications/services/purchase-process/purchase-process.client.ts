import { Injectable } from '@nestjs/common'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from 'apps/cores'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'

@Injectable()
export class PurchaseProcessClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    processPurchase(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.getJson(Messages.PurchaseProcess.processPurchase, createDto)
    }
}
