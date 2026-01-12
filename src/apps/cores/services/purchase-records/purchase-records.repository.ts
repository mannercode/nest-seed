import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseRepository } from 'common'
import { Model } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { CreatePurchaseRecordDto } from './dtos'
import { PurchaseRecord } from './models'

@Injectable()
export class PurchaseRecordsRepository extends MongooseRepository<PurchaseRecord> {
    constructor(
        @InjectModel(PurchaseRecord.name, MongooseConfigModule.connectionName)
        readonly model: Model<PurchaseRecord>
    ) {
        super(model, MongooseConfigModule.maxTake)
    }

    async create(createDto: CreatePurchaseRecordDto) {
        const purchase = this.newDocument()
        purchase.customerId = createDto.customerId
        purchase.paymentId = createDto.paymentId
        purchase.totalPrice = createDto.totalPrice
        purchase.purchaseItems = createDto.purchaseItems.map((item) => ({ ...item }))

        await purchase.save()

        return purchase.toJSON()
    }
}
