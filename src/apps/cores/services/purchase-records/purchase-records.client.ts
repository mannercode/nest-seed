import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsClient {
    constructor(@InjectClientProxy() private proxy: ClientProxyService) {}

    createPurchseRecord(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.getJson(Messages.Purchases.createPurchseRecord, createDto)
    }

    getPurchases(purchaseIds: string[]): Promise<PurchaseRecordDto[]> {
        return this.proxy.getJson(Messages.Purchases.getPurchases, purchaseIds)
    }
}
