import { Injectable, Logger } from '@nestjs/common'
import { BulkCreateShowtimesDto } from '../dtos/index.js'
import { ShowtimeCreationWorkflowClient } from '../worker/index.js'

@Injectable()
export class ShowtimeCreationOrchestratorService {
    private readonly logger = new Logger(ShowtimeCreationOrchestratorService.name)

    constructor(private readonly workflow: ShowtimeCreationWorkflowClient) {}

    async ensureShowtimeCreationJobStarted(
        createDto: BulkCreateShowtimesDto,
        sagaId: string
    ): Promise<void> {
        this.logger.log('ensureShowtimeCreationJobStarted', { sagaId })

        // sagaId가 Restate workflow key이므로 제출 응답을 잃은 재시도도 기존 실행을 가리킨다.
        // 상태 이벤트는 workflow 내부 순서를 유지하지만 journal 기록 직전 장애에서는 재발행될 수 있다.
        await this.workflow.submit({ createDto, sagaId }, sagaId)
    }

    getShowtimeCreationStatus(sagaId: string) {
        return this.workflow.getStatus(sagaId)
    }
}
