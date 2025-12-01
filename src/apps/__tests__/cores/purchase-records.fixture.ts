import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordDto, PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { createPurchaseRecord, TestFixture, createTestFixture } from '../__helpers__'

export type PurchaseRecordsFixture = TestFixture & {
    purchaseRecordsService: PurchaseRecordsClient
    createdPurchaseRecord: PurchaseRecordDto
}

export async function createPurchaseRecordsFixture(): Promise<PurchaseRecordsFixture> {
    const fix = await createTestFixture({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsService = fix.module.get(PurchaseRecordsClient)

    const createdPurchaseRecord = await createPurchaseRecord(fix)

    return { ...fix, purchaseRecordsService, createdPurchaseRecord }
}
