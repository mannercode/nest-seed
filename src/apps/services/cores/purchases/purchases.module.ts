import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { PaymentsModule } from 'infrastructures'
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
        ),
        PaymentsModule
    ],
    providers: [PurchasesService, PurchasesRepository],
    controllers: [PurchasesController],
    exports: [PurchasesService]
})
export class PurchasesModule {}
