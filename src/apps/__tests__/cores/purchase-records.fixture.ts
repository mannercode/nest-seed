import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordDto, PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { createPurchaseRecord2, TestFixture, createTestFixture } from '../__helpers__'

export interface Fixture extends TestFixture {
    purchaseRecordsService: PurchaseRecordsClient
    createdPurchaseRecord: PurchaseRecordDto
}

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createTestFixture({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsService = fix.module.get(PurchaseRecordsClient)

    const createdPurchaseRecord = await createPurchaseRecord2(fix)

    return { ...fix, purchaseRecordsService, createdPurchaseRecord }
}
