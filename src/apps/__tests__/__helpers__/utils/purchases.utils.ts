import { PurchaseItemType } from 'apps/cores'
import { oid } from 'testlib'
import { CommonFixture } from '../create-common-fixture'

export const buildCreatePurchaseDto = (overrides = {}) => {
    const createDto = {
        customerId: oid(0x0),
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: oid(0x0) }],
        ...overrides
    }
    return createDto
}

export const createPurchase = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreatePurchaseDto(override)

    const purchase = await fix.purchasesService.createPurchase(createDto)

    return purchase
}
