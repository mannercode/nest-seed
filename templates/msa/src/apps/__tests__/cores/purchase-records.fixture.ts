import type { AppTestContext } from 'apps/__tests__/__helpers__'
import { createAppTestContext } from 'apps/__tests__/__helpers__'
import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchaseHttpController } from 'apps/gateway'

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
