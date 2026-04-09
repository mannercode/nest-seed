import { ClientProxyService, InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { Messages } from 'config'
import { CreatePurchaseRecordDto, PurchaseRecordDto } from './dtos'

@Injectable()
export class PurchaseRecordsClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    delete(purchaseRecordId: string): Promise<void> {
        return this.proxy.request(Messages.PurchaseRecords.delete, purchaseRecordId)
    }

    create(createDto: CreatePurchaseRecordDto): Promise<PurchaseRecordDto> {
        return this.proxy.request(Messages.PurchaseRecords.create, createDto)
    }
}
