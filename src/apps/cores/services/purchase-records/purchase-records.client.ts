import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    create(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.request(Messages.PurchaseRecords.create, createDto)
    }

    getMany(purchaseRecordIds: string[]): Promise<PurchaseRecordDto[]> {
        return this.proxy.request(Messages.PurchaseRecords.getMany, purchaseRecordIds)
    }
}
