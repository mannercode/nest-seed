import { PurchaseModule } from 'application'
import { PurchaseRecordsModule, PurchaseRecordsService } from 'core'
import { PurchaseHttpController } from 'gateway'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type PurchaseRecordsFixture = AppTestContext & {
    purchaseRecordsService: PurchaseRecordsService
}

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const ctx = await createAppTestContext({
        controllers: [PurchaseHttpController],
        imports: [PurchaseRecordsModule, PurchaseModule]
    })

    const purchaseRecordsService = ctx.module.get(PurchaseRecordsService)
    return { ...ctx, purchaseRecordsService }
}
