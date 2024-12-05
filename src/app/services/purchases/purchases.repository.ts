import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { MethodLog, MongooseRepository, objectId } from 'common'
import { Model } from 'mongoose'
import { PurchaseCreateDto } from './dtos'
import { Purchase } from './models'

@Injectable()
export class PurchasesRepository extends MongooseRepository<Purchase> {
    constructor(@InjectModel(Purchase.name, 'mongo') model: Model<Purchase>) {
        super(model)
    }

    @MethodLog()
    async createPurchase(createDto: PurchaseCreateDto) {
        const purchase = this.newDocument()
        purchase.customerId = objectId(createDto.customerId)
        purchase.totalPrice = createDto.totalPrice
        purchase.items = createDto.items

        await purchase.save()

        return purchase
    }
}
