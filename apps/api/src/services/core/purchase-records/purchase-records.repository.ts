import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME } from 'config'
import { Model } from 'mongoose'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'

@Injectable()
export class PurchaseRecordsRepository extends CrudRepository<PurchaseRecord> {
    constructor(
        @InjectModel(PurchaseRecord.name, MONGO_CONNECTION_NAME)
        readonly model: Model<PurchaseRecord>,
        config: AppConfigService
    ) {
        super(model, config.http.paginationDefaultSize)
    }

    async create(createDto: CreatePurchaseRecordDto) {
        const purchaseRecord = this.newDocument()
        purchaseRecord.userId = createDto.userId
        purchaseRecord.paymentId = createDto.paymentId
        purchaseRecord.totalPrice = createDto.totalPrice
        purchaseRecord.purchaseItems = createDto.purchaseItems

        await purchaseRecord.save()

        return purchaseRecord.toJSON()
    }
}
