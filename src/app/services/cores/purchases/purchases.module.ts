import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { EventService } from 'common'
import { MongooseConfig } from 'config'
import { PaymentsModule } from 'services/infrastructures'
import { Purchase, PurchaseSchema } from './models'
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
    providers: [PurchasesService, PurchasesRepository, EventService],
    exports: [PurchasesService]
})
export class PurchasesModule {}
