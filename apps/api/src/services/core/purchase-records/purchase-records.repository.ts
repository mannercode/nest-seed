import { CrudRepository } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Model } from 'mongoose'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'

@Injectable()
export class PurchaseRecordsRepository extends CrudRepository<PurchaseRecord> {
    constructor(
        @InjectModel(PurchaseRecord.name, MongooseSetupModule.connectionName)
        readonly model: Model<PurchaseRecord>
    ) {
        super(model, MongooseSetupModule.maxTake)
    }

    async create(createDto: CreatePurchaseRecordDto) {
        const purchaseRecord = this.newDocument()
        purchaseRecord.userId = createDto.userId
        purchaseRecord.paymentId = createDto.paymentId
        purchaseRecord.totalPrice = createDto.totalPrice
        purchaseRecord.purchaseItems = createDto.purchaseItems.map((item) => ({ ...item }))

        await purchaseRecord.save()

        return purchaseRecord.toJSON()
    }
}
