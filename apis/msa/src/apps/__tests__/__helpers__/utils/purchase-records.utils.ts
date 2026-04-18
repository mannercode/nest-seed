import { oid, TestContext } from '@mannercode/testing'
import { CreatePurchaseRecordDto, PurchaseItemType } from 'cores'

export function buildCreatePurchaseRecordDto(
    overrides: Partial<CreatePurchaseRecordDto> = {}
): CreatePurchaseRecordDto {
    return {
        customerId: oid(0x0),
        paymentId: oid(0x0),
        purchaseItems: [{ itemId: oid(0x0), type: PurchaseItemType.Tickets }],
        totalPrice: 1,
        ...overrides
    }
}

export async function createPurchaseRecord(
    ctx: TestContext,
    override: Partial<CreatePurchaseRecordDto> = {}
) {
    const { PurchaseRecordsService } = await import('cores')
    const purchaseRecordsService = ctx.module.get(PurchaseRecordsService)

    const createDto = buildCreatePurchaseRecordDto(override)

    const purchaseRecord = await purchaseRecordsService.create(createDto)
    return purchaseRecord
}
