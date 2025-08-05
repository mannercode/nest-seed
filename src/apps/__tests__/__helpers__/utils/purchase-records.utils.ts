import { PurchaseItemType } from 'apps/cores'
import { oid, TestContext } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

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

export const createPurchseRecord = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreatePurchaseRecordDto(override)

    const purchase = await fix.purchasesService.createPurchseRecord(createDto)

    return purchase
}

export const createPurchseRecord2 = async ({ module }: TestContext, override = {}) => {
    const { PurchaseRecordsClient } = await import('apps/cores')
    const purchasesService = module.get(PurchaseRecordsClient)

    const createDto = buildCreatePurchaseRecordDto(override)

    const purchase = await purchasesService.createPurchseRecord(createDto)
    return purchase
}
