import { PurchaseClient } from 'applications'
import { PurchaseRecordsClient, PurchaseRecordsModule } from 'cores'
import { PurchaseHttpController } from 'gateway'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type PurchaseRecordsFixture = AppTestContext & {
    purchaseRecordsClient: PurchaseRecordsClient
}

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const ctx = await createAppTestContext({
        controllers: [PurchaseHttpController],
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient]
    })

    const purchaseRecordsClient = ctx.module.get(PurchaseRecordsClient)
    return { ...ctx, purchaseRecordsClient }
}
