import { Injectable } from '@nestjs/common'
import {
    connect,
    rpc,
    type Ingress,
    type WorkflowSubmission
} from '@restatedev/restate-sdk-clients'
import { AppConfigService } from '#config'
import type { ShowtimeCreationWorkflowInput } from './types.js'
import { ShowtimeCreationWorkflow } from './workflow.js'

const SUBMIT_ATTEMPT_TIMEOUT_MS = 10_000

@Injectable()
export class ShowtimeCreationWorkflowClient {
    private readonly ingress: Ingress

    constructor(
        private readonly workflow: ShowtimeCreationWorkflow,
        config: AppConfigService
    ) {
        this.ingress = connect({
            retry: {
                initialInterval: 250,
                maxAttempts: 6,
                maxDuration: 60_000,
                maxInterval: 3_000
            },
            url: config.restate.ingressUrl
        })
    }

    async submit(
        input: ShowtimeCreationWorkflowInput,
        sagaId: string
    ): Promise<WorkflowSubmission<void>> {
        return this.ingress
            .workflowClient(this.workflow.definition, sagaId)
            .workflowSubmit(input, rpc.sendOpts({ timeout: SUBMIT_ATTEMPT_TIMEOUT_MS }))
    }

    waitForCompletion(submission: WorkflowSubmission<void>) {
        return this.ingress.result(submission)
    }
}
