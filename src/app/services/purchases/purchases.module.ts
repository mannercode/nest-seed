import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Purchase, PurchaseSchema } from './models'
import { PurchasesRepository } from './purchases.repository'
import { PurchasesService } from './purchases.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: Purchase.name, schema: PurchaseSchema }], 'mongo')],
    providers: [PurchasesService, PurchasesRepository],
    exports: [PurchasesService]
})
export class PurchasesModule {}
