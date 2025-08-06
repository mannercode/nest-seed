import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    createPurchaseRecord(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.getJson(Messages.Purchases.createPurchaseRecord, createDto)
    }

    getPurchases(purchaseIds: string[]): Promise<PurchaseRecordDto[]> {
        return this.proxy.getJson(Messages.Purchases.getPurchases, purchaseIds)
    }
}
