import { newObjectIdString } from '@mannercode/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Client, WorkflowIdReusePolicy } from '@temporalio/client'
import { TemporalSetupModule } from 'modules'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { getShowtimeCreationTaskQueue, SHOWTIME_CREATION_WORKFLOW } from '../temporal'
import { ShowtimeCreationStatus } from './types'

@Injectable()
export class ShowtimeCreationOrchestratorService {
    private readonly logger = new Logger(ShowtimeCreationOrchestratorService.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        @Inject(TemporalSetupModule.clientToken) private readonly temporal: Client
    ) {}

    async enqueueShowtimeCreationJob(createDto: BulkCreateShowtimesDto): Promise<string> {
        const sagaId = newObjectIdString()

        this.logger.log('enqueueShowtimeCreationJob', { sagaId })

        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })

        // workflowId == sagaId 로 두면 Temporal history 와 saga 가 묶이고,
        // 동시에 dedup key 역할도 한다 — Reject 가 같은 id 로 중복 start 되는 것을
        // 막아준다.
        await this.temporal.workflow.start(SHOWTIME_CREATION_WORKFLOW, {
            args: [{ createDto, sagaId }],
            taskQueue: getShowtimeCreationTaskQueue(),
            workflowId: sagaId,
            workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE
        })

        return sagaId
    }
}
