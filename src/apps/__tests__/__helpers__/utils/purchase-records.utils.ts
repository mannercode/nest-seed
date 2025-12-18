import { PurchaseItemType } from 'apps/cores'
import type { TestContext } from 'testlib'
import { oid } from 'testlib'

export function buildCreatePurchaseRecordDto(overrides = {}) {
    const createDto = {
        customerId: oid(0x0),
        paymentId: oid(0x0),
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: oid(0x0) }],
        ...overrides
    }
    return createDto
}

export async function createPurchaseRecord(ctx: TestContext, override = {}) {
    const { PurchaseRecordsClient } = await import('apps/cores')
    const purchaseRecordsClient = ctx.module.get(PurchaseRecordsClient)

    const createDto = buildCreatePurchaseRecordDto(override)

    const purchase = await purchaseRecordsClient.create(createDto)
    return purchase
}
