import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { createTestFixture, TestFixture } from '../__helpers__'

export type PurchaseRecordsFixture = TestFixture & { purchaseRecordsService: PurchaseRecordsClient }

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const fix = await createTestFixture({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsService = fix.module.get(PurchaseRecordsClient)
    return { ...fix, purchaseRecordsService }
}
