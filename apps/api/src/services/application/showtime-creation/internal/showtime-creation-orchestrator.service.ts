import { getTemporalClientToken, newObjectIdString } from '@mannercode/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Client, WorkflowIdReusePolicy } from '@temporalio/client'
import { TEMPORAL_CLIENT_NAME } from 'config'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { getShowtimeCreationTaskQueue, SHOWTIME_CREATION_WORKFLOW } from '../temporal'
import { ShowtimeCreationStatus } from './types'

@Injectable()
export class ShowtimeCreationOrchestratorService {
    private readonly logger = new Logger(ShowtimeCreationOrchestratorService.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        @Inject(getTemporalClientToken(TEMPORAL_CLIENT_NAME)) private readonly temporal: Client
    ) {}

    async enqueueShowtimeCreationJob(createDto: BulkCreateShowtimesDto): Promise<string> {
        const sagaId = newObjectIdString()

        this.logger.log('enqueueShowtimeCreationJob', { sagaId })

        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })

        // `workflowId` 를 `sagaId` 와 같게 둔다. 그러면 Temporal 의 실행
        // 기록과 saga 가 같은 키로 연결된다. 같은 ID 로 두 번 시작하려는
        // 요청은 `REJECT_DUPLICATE` 옵션 덕에 두 번째에서 거절된다. 별도
        // 중복 방지 키를 만들 필요가 없다.
        await this.temporal.workflow.start(SHOWTIME_CREATION_WORKFLOW, {
            args: [{ createDto, sagaId }],
            taskQueue: getShowtimeCreationTaskQueue(),
            workflowId: sagaId,
            workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE
        })

        return sagaId
    }
}
