import { BaseService } from '@mannercode/nest-common'
import { TEMPORAL_CLIENT } from '@mannercode/nest-microservice'
import { HttpException, Inject, Injectable } from '@nestjs/common'
import { ApplicationFailure, Client, WorkflowFailedError } from '@temporalio/client'
import { getTemporalTaskQueue } from 'common'
import type { purchaseWorkflow } from './workflows/purchase.workflow'
import { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseService extends BaseService {
    constructor(@Inject(TEMPORAL_CLIENT) private readonly temporalClient: Client) {
        super()
    }

    async processPurchase(createDto: CreatePurchaseDto) {
        const workflowId = `purchase-${createDto.customerId}-${Date.now()}`

        this.log.info('processPurchase', { workflowId, customerId: createDto.customerId })

        const handle = await this.temporalClient.workflow.start<typeof purchaseWorkflow>(
            'purchaseWorkflow',
            { taskQueue: getTemporalTaskQueue(), workflowId, args: [createDto] }
        )

        try {
            const result = await handle.result()
            this.log.info('processPurchase completed', { workflowId })
            return result
        } catch (error) {
            this.log.warn('processPurchase failed', { workflowId, error: String(error) })
            throw unwrapWorkflowError(error as WorkflowFailedError)
        }
    }
}

function unwrapWorkflowError(error: WorkflowFailedError): Error {
    const appFailure = error.cause?.cause
    if (appFailure instanceof ApplicationFailure && appFailure.type === 'HttpException') {
        const { status, response } = JSON.parse(appFailure.message)
        return new HttpException(response, status)
    }
    return error
}
