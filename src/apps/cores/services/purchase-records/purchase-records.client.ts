import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.getJson(Messages.Purchases.create, createDto)
    }

    getMany(purchaseIds: string[]): Promise<PurchaseRecordDto[]> {
        return this.proxy.getJson(Messages.Purchases.getMany, purchaseIds)
    }
}
