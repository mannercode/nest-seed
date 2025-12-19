import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import type { AppTestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type PurchaseRecordsFixture = AppTestContext & {
    purchaseRecordsClient: PurchaseRecordsClient
}

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const ctx = await createAppTestContext({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsClient = ctx.module.get(PurchaseRecordsClient)
    return { ...ctx, purchaseRecordsClient }
}
