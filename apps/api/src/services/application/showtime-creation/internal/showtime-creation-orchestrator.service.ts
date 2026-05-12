import {
    Client,
    getTemporalClientToken,
    newObjectIdString,
    WorkflowIdReusePolicy
} from '@mannercode/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { TEMPORAL_CLIENT_NAME } from 'config'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { getShowtimeCreationTaskQueue } from '../worker'
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

        // `workflowId`를 `sagaId`와 같게 두어 Temporal 실행 기록과 API 응답의
        // saga 식별자를 연결합니다. 같은 ID로 두 번 시작하려는 요청은
        // `REJECT_DUPLICATE` 옵션이 막으므로 별도 중복 방지 키가 필요 없습니다.
        await this.temporal.workflow.start('showtimeCreationWorkflow', {
            args: [{ createDto, sagaId }],
            taskQueue: getShowtimeCreationTaskQueue(),
            workflowId: sagaId,
            workflowIdReusePolicy: WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE
        })

        return sagaId
    }
}
