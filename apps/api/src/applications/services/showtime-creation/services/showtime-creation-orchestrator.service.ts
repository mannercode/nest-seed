import { newObjectIdString } from '@mannercode/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Client, WorkflowIdReusePolicy } from '@temporalio/client'
import { TemporalConfigModule } from 'config'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { getShowtimeCreationTaskQueue, SHOWTIME_CREATION_WORKFLOW } from '../temporal'
import { ShowtimeCreationStatus } from './types'

@Injectable()
export class ShowtimeCreationOrchestratorService {
    private readonly logger = new Logger(ShowtimeCreationOrchestratorService.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        @Inject(TemporalConfigModule.clientToken) private readonly temporal: Client
    ) {}

    async enqueueShowtimeCreationJob(createDto: BulkCreateShowtimesDto): Promise<string> {
        const sagaId = newObjectIdString()

        this.logger.log('enqueueShowtimeCreationJob', { sagaId })

        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })

        // workflowId == sagaId both ties Temporal history to the saga and
        // doubles as a dedup key — Reject prevents duplicate starts on the
        // same id.
        await this.temporal.workflow.start(SHOWTIME_CREATION_WORKFLOW, {
            args: [{ createDto, sagaId }],
            taskQueue: getShowtimeCreationTaskQueue(),
            workflowId: sagaId,
            workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE
        })

        return sagaId
    }
}
