import { RestateWorkflowClient } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import { PurchaseResultSchema, type PurchaseResult } from '../internal/purchase-result.js'
import { PurchaseWorkflow } from './workflow.js'
import type { PurchaseWorkflowInput } from './types.js'

@Injectable()
export class PurchaseWorkflowClient extends RestateWorkflowClient<
    PurchaseWorkflowInput,
    PurchaseResult
> {
    constructor(workflow: PurchaseWorkflow, config: AppConfigService) {
        super(workflow.definition, config.restate.ingressUrl, PurchaseResultSchema)
    }
}
