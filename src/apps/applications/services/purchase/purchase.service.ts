import { TEMPORAL_CLIENT } from '@mannercode/nestlib-microservice'
import { HttpException, Inject, Injectable } from '@nestjs/common'
import { ApplicationFailure, Client, WorkflowFailedError } from '@temporalio/client'
import { getTemporalTaskQueue } from 'shared'
import type { purchaseWorkflow } from './workflows/purchase.workflow'
import { CreatePurchaseDto } from './dtos'

@Injectable()
export class PurchaseService {
    constructor(@Inject(TEMPORAL_CLIENT) private readonly temporalClient: Client) {}

    async processPurchase(createDto: CreatePurchaseDto) {
        const handle = await this.temporalClient.workflow.start<typeof purchaseWorkflow>(
            'purchaseWorkflow',
            {
                taskQueue: getTemporalTaskQueue(),
                workflowId: `purchase-${createDto.customerId}-${Date.now()}`,
                args: [createDto]
            }
        )

        try {
            return await handle.result()
        } catch (error) {
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
