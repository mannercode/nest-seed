import { Injectable } from '@nestjs/common'
import {
    connect,
    rpc,
    type Ingress,
    type WorkflowSubmission
} from '@restatedev/restate-sdk-clients'
import { AppConfigService } from '#config'
import type {
    ShowtimeCreationStatusResponse,
    ShowtimeCreationTerminalEvent
} from '../internal/index.js'
import type { ShowtimeCreationWorkflowInput } from './types.js'
import { TemporalJsonSerde } from './temporal-json.serde.js'
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
            serde: TemporalJsonSerde,
            url: config.restate.ingressUrl
        })
    }

    async submit(
        input: ShowtimeCreationWorkflowInput,
        sagaId: string
    ): Promise<WorkflowSubmission<ShowtimeCreationTerminalEvent>> {
        return this.ingress
            .workflowClient(this.workflow.definition, sagaId)
            .workflowSubmit(input, rpc.sendOpts({ timeout: SUBMIT_ATTEMPT_TIMEOUT_MS }))
    }

    async getStatus(sagaId: string): Promise<ShowtimeCreationStatusResponse> {
        const output = await this.ingress
            .workflowClient(this.workflow.definition, sagaId)
            .workflowOutput(rpc.opts({ timeout: SUBMIT_ATTEMPT_TIMEOUT_MS }))

        return output.ready ? output.result : { sagaId, status: 'pending' }
    }

    waitForCompletion(submission: WorkflowSubmission<ShowtimeCreationTerminalEvent>) {
        return this.ingress.result(submission)
    }
}
