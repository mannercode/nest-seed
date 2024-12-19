import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PaymentsProxy } from 'infrastructures'
import { MongooseConfig } from '../../config'
import { Purchase, PurchaseSchema } from './models'
import { PurchasesController } from './purchases.controller'
import { PurchasesRepository } from './purchases.repository'
import { PurchasesService } from './purchases.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Purchase.name, schema: PurchaseSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [PurchasesService, PurchasesRepository, PaymentsProxy],
    controllers: [PurchasesController],
    exports: [PurchasesService]
})
export class PurchasesModule {}
