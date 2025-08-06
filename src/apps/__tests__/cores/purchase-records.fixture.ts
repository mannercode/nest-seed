import { PurchaseClient } from 'apps/applications'
import { PurchaseRecordDto, PurchaseRecordsClient, PurchaseRecordsModule } from 'apps/cores'
import { PurchasesController } from 'apps/gateway'
import { createPurchaseRecord2, HttpTestFixture, setupHttpTestContext } from '../__helpers__'

export interface Fixture extends HttpTestFixture {
    purchaseRecordsService: PurchaseRecordsClient
    createdPurchaseRecord: PurchaseRecordDto
}

export const createFixture = async (): Promise<Fixture> => {
    const context = await setupHttpTestContext({
        imports: [PurchaseRecordsModule],
        providers: [PurchaseRecordsClient, PurchaseClient],
        controllers: [PurchasesController]
    })

    const purchaseRecordsService = context.module.get(PurchaseRecordsClient)

    const createdPurchaseRecord = await createPurchaseRecord2(context)

    return { ...context, purchaseRecordsService, createdPurchaseRecord }
}
