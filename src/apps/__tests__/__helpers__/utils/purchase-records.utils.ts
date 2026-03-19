import type { TestContext } from '@mannercode/nest-testing'
import { oid } from '@mannercode/nest-testing'
import { PurchaseItemType } from 'apps/cores'

export function buildCreatePurchaseRecordDto(overrides = {}) {
    const createDto = {
        customerId: oid(0x0),
        paymentId: oid(0x0),
        purchaseItems: [{ itemId: oid(0x0), type: PurchaseItemType.Tickets }],
        totalPrice: 1,
        ...overrides
    }
    return createDto
}

export async function createPurchaseRecord(ctx: TestContext, override = {}) {
    const { PurchaseRecordsService } = await import('apps/cores')
    const purchaseRecordsService = ctx.module.get(PurchaseRecordsService)

    const createDto = buildCreatePurchaseRecordDto(override)

    const purchaseRecord = await purchaseRecordsService.create(createDto)
    return purchaseRecord
}
