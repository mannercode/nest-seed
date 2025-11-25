import { PurchaseItemType } from 'apps/cores'
import { oid, TestContext } from 'testlib'

export const buildCreatePurchaseRecordDto = (overrides = {}) => {
    const createDto = {
        customerId: oid(0x0),
        paymentId: oid(0x0),
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: oid(0x0) }],
        ...overrides
    }
    return createDto
}

export const createPurchaseRecord = async ({ module }: TestContext, override = {}) => {
    const { PurchaseRecordsClient } = await import('apps/cores')
    const purchasesService = module.get(PurchaseRecordsClient)

    const createDto = buildCreatePurchaseRecordDto(override)

    const purchase = await purchasesService.create(createDto)
    return purchase
}
