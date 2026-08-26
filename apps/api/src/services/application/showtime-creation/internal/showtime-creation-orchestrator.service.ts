import { Client, getTemporalClientToken, WorkflowIdReusePolicy } from '@mannercode/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { WorkflowExecutionAlreadyStartedError } from '@temporalio/client'
import { AppConfigService, TEMPORAL_CLIENT_NAME } from 'config'
import { BulkCreateShowtimesDto } from '../dtos'
import { getShowtimeCreationTaskQueue } from '../showtime-creation-task-queue'
import { ShowtimeCreationEvents } from '../showtime-creation.events'
import { ShowtimeCreationStatus } from './types'

@Injectable()
export class ShowtimeCreationOrchestratorService {
    private readonly logger = new Logger(ShowtimeCreationOrchestratorService.name)

    constructor(
        private readonly events: ShowtimeCreationEvents,
        @Inject(getTemporalClientToken(TEMPORAL_CLIENT_NAME)) private readonly temporal: Client,
        private readonly config: AppConfigService
    ) {}

    async ensureShowtimeCreationJobStarted(
        createDto: BulkCreateShowtimesDto,
        sagaId: string
    ): Promise<void> {
        this.logger.log('ensureShowtimeCreationJobStarted', { sagaId })

        // `workflowId`를 `sagaId`와 같게 두어 Temporal 실행 기록과 API 응답의 사가 식별자를 연결한다.
        // 같은 ID로 두 번 시작하려는 요청은 `REJECT_DUPLICATE` 옵션이 막으므로 별도 중복 방지 키가 필요 없다.
        try {
            await this.temporal.workflow.start('showtimeCreationWorkflowV2', {
                args: [{ createDto, sagaId }],
                taskQueue: getShowtimeCreationTaskQueue(this.config.projectId),
                workflowId: sagaId,
                workflowIdReusePolicy:
                    WorkflowIdReusePolicy.WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE
            })
        } catch (error) {
            // HTTP 서버가 workflow 시작 응답을 받지 못하고 종료된 경우, lease를 이어받은
            // 재시도는 같은 saga ID가 이미 시작됐음을 성공으로 해석해야 한다.
            if (!(error instanceof WorkflowExecutionAlreadyStartedError)) throw error
            return
        }

        // Waiting은 이 호출이 워크플로를 처음 시작한 경우에만 발행한다. 시작 응답을 잃은
        // 재시도가 이미 실행 중인 워크플로 뒤에 Waiting을 다시 발행하면 상태가 역행한다.
        // 순서가 반대면 시작 실패 시에도 SSE 구독자가 Waiting을 받고 그 뒤 어떤 이벤트도 받지 못해 sagaId가 영원히 미완료 상태로 보인다.
        await this.events.emitStatusChanged({ sagaId, status: ShowtimeCreationStatus.Waiting })
    }
}
