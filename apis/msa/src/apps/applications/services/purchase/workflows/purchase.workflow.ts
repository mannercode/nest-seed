import { log, proxyActivities } from '@temporalio/workflow'
import type { PurchaseActivities } from '../activities'
import type { CreatePurchaseDto } from '../dtos'

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

export async function purchaseWorkflow(createDto: CreatePurchaseDto) {
    const compensations: Array<() => Promise<void>> = []

    log.info('purchaseWorkflow', { customerId: createDto.customerId })

    try {
        await validatePurchase(createDto)

        const payment = await createPayment(createDto.totalPrice, createDto.customerId)
        compensations.push(() => cancelPayment(payment.id))
        log.info('purchaseWorkflow createPayment completed', { paymentId: payment.id })

        const purchaseRecord = await createPurchaseRecord({ ...createDto, paymentId: payment.id })
        compensations.push(() => deletePurchaseRecord(purchaseRecord.id))
        log.info('purchaseWorkflow createPurchaseRecord completed', {
            purchaseRecordId: purchaseRecord.id
        })

        await completePurchase(createDto)
        log.info('purchaseWorkflow completed', { customerId: createDto.customerId })

        return purchaseRecord
    } catch (error) {
        log.warn('purchaseWorkflow failed, executing compensations', { error: String(error) })

        for (const compensation of compensations.reverse()) {
            try {
                await compensation()
            } catch (compensationError) {
                log.error('compensation failed', {
                    error:
                        compensationError instanceof Error
                            ? compensationError.message
                            : String(compensationError)
                })
            }
        }

        try {
            log.warn('purchaseWorkflow rollbackPurchase', { customerId: createDto.customerId })
            await rollbackPurchase(createDto)
        } catch (rollbackError) {
            log.error('rollback failed', {
                error:
                    rollbackError instanceof Error ? rollbackError.message : String(rollbackError)
            })
        }

        throw error
    }
}
