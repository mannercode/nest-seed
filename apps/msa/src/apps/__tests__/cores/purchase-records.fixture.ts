import { PurchaseRecordsClient, PurchaseRecordsModule } from 'cores'
import { createAppTestContext, AppTestContext } from '../__helpers__'

export type PurchaseRecordsFixture = AppTestContext & {
    purchaseRecordsClient: PurchaseRecordsClient
}

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const ctx = await createAppTestContext({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient]
    })

    const purchaseRecordsClient = ctx.module.get(PurchaseRecordsClient)
    return { ...ctx, purchaseRecordsClient }
}
