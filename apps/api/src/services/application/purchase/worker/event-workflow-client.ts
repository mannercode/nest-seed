import { z } from 'zod'
import { RestateWorkflowClient } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import type { PurchaseRecordDto } from '#core'
import { PurchaseEventWorkflow } from './event-workflow.js'

@Injectable()
export class PurchaseEventWorkflowClient extends RestateWorkflowClient<PurchaseRecordDto, void> {
    constructor(workflow: PurchaseEventWorkflow, config: AppConfigService) {
        super(workflow.definition, config.restate.ingressUrl, z.void())
    }
}
