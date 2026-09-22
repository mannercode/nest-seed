import { RestateWorkflowClient, type DurableWorkflowSubmission } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { AppConfigService } from '#config'
import {
    ShowtimeCreationTerminalEventSchema,
    type ShowtimeCreationStatusResponse,
    type ShowtimeCreationTerminalEvent
} from '../internal/index.js'
import type { ShowtimeCreationWorkflowInput } from './types.js'
import { ShowtimeCreationWorkflow } from './workflow.js'

@Injectable()
export class ShowtimeCreationWorkflowClient {
    private readonly client: RestateWorkflowClient<
        ShowtimeCreationWorkflowInput,
        ShowtimeCreationTerminalEvent
    >

    constructor(workflow: ShowtimeCreationWorkflow, config: AppConfigService) {
        this.client = new RestateWorkflowClient(
            workflow.definition,
            config.restate.ingressUrl,
            ShowtimeCreationTerminalEventSchema
        )
    }

    submit(
        input: ShowtimeCreationWorkflowInput,
        sagaId: string
    ): Promise<DurableWorkflowSubmission<ShowtimeCreationTerminalEvent>> {
        return this.client.submit(input, sagaId)
    }

    async getStatus(sagaId: string): Promise<ShowtimeCreationStatusResponse> {
        const output = await this.client.output(sagaId)
        return output.ready ? output.result : { sagaId, status: 'pending' }
    }

    waitForCompletion(submission: DurableWorkflowSubmission<ShowtimeCreationTerminalEvent>) {
        return this.client.waitForCompletion(submission)
    }
}
