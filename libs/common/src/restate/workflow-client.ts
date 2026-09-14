import type { WorkflowContext } from '@restatedev/restate-sdk'
import {
    connect,
    rpc,
    type Ingress,
    type WorkflowSubmission
} from '@restatedev/restate-sdk-clients'
import type { DurableWorkflowDefinition } from './workflow.js'
import { TemporalJsonSerde } from './temporal-json.serde.js'

export type DurableWorkflowSubmission<Output> = WorkflowSubmission<Output>

const SUBMIT_ATTEMPT_TIMEOUT_MS = 10_000

export class RestateWorkflowClient<Input, Output> {
    private readonly ingress: Ingress

    constructor(
        private readonly definition: DurableWorkflowDefinition<Input, Output>,
        ingressUrl: string
    ) {
        this.ingress = connect({
            retry: {
                initialInterval: 250,
                maxAttempts: 6,
                maxDuration: 60_000,
                maxInterval: 3_000
            },
            serde: TemporalJsonSerde,
            url: ingressUrl
        })
    }

    async submit(input: Input, workflowId: string): Promise<DurableWorkflowSubmission<Output>> {
        return this.ingress
            .workflowClient<{ run: (context: WorkflowContext, input: Input) => Promise<Output> }>(
                this.definition,
                workflowId
            )
            .workflowSubmit(input, rpc.sendOpts({ timeout: SUBMIT_ATTEMPT_TIMEOUT_MS }))
    }

    async output(workflowId: string) {
        return this.ingress
            .workflowClient<{ run: (context: WorkflowContext, input: Input) => Promise<Output> }>(
                this.definition,
                workflowId
            )
            .workflowOutput(rpc.opts({ timeout: SUBMIT_ATTEMPT_TIMEOUT_MS }))
    }

    waitForCompletion(submission: DurableWorkflowSubmission<Output>): Promise<Output> {
        return this.ingress.result(submission)
    }
}
