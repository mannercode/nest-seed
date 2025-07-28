import { PurchaseItemType } from 'apps/cores'
import { newObjectId } from 'common'
import { CommonFixture } from '../__helpers__'

export const buildCreatePurchaseDto = (overrides = {}) => {
    const createDto = {
        customerId: newObjectId(),
        totalPrice: 1,
        purchaseItems: [{ type: PurchaseItemType.Ticket, ticketId: newObjectId() }],
        ...overrides
    }
    return createDto
}

export const createPurchase = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreatePurchaseDto(override)

    const purchase = await fix.purchasesService.createPurchase(createDto)

    return purchase
}
