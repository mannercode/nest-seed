import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordDto, PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { createPurchseRecord2, HttpTestFixture, setupHttpTestContext } from '../__helpers__'

export interface PurchasesFixture extends HttpTestFixture {
    purchaseRecordsService: PurchaseRecordsClient
    createdPurchaseRecord: PurchaseRecordDto
}

export const createFixture = async (): Promise<PurchasesFixture> => {
    const context = await setupHttpTestContext({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsService = context.module.get(PurchaseRecordsClient)

    const createdPurchaseRecord = await createPurchseRecord2(context)

    return { ...context, purchaseRecordsService, createdPurchaseRecord }
}
