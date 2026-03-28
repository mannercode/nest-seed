import { PurchaseModule } from 'applications'
import { PurchaseHttpController } from 'controllers'
import { PurchaseRecordsModule, PurchaseRecordsService } from 'cores'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

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
