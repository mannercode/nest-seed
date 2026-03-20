import { MongooseRepository } from '@mannercode/nest-common'
import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'
import { Model } from 'mongoose'
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

    async delete(purchaseRecordId: string) {
        await this.deleteById(purchaseRecordId)
    }

    async create(createDto: CreatePurchaseRecordDto) {
        const purchaseRecord = this.newDocument()
        purchaseRecord.customerId = createDto.customerId
        purchaseRecord.paymentId = createDto.paymentId
        purchaseRecord.totalPrice = createDto.totalPrice
        purchaseRecord.purchaseItems = createDto.purchaseItems.map((item) => ({ ...item }))

        await purchaseRecord.save()

        return purchaseRecord.toJSON()
    }
}
