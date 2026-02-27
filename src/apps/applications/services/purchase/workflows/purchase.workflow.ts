import { proxyActivities } from '@temporalio/workflow'
import type { PurchaseActivities, PurchaseInput } from '../activities/purchase.activities'

const {
    validatePurchase,
    createPayment,
    createPurchaseRecord,
    completePurchase,
    cancelPayment,
    deletePurchaseRecord,
    rollbackPurchase
} = proxyActivities<PurchaseActivities>({
    startToCloseTimeout: '30s',
    retry: { maximumAttempts: 1 }
})

export async function purchaseWorkflow(createDto: PurchaseInput) {
    const compensations: Array<() => Promise<void>> = []

    try {
        await validatePurchase(createDto)

        const payment = await createPayment(createDto.totalPrice, createDto.customerId)
        compensations.push(() => cancelPayment(payment.id))

        const purchaseRecord = await createPurchaseRecord({ ...createDto, paymentId: payment.id })
        compensations.push(() => deletePurchaseRecord(purchaseRecord.id))

        await completePurchase(createDto)

        return purchaseRecord
    } catch (error) {
        for (const compensation of compensations.reverse()) {
            try {
                await compensation()
            } catch {
                /* compensation best-effort */
            }
        }

        try {
            await rollbackPurchase(createDto)
        } catch {
            /* rollback best-effort */
        }

        throw error
    }
}
