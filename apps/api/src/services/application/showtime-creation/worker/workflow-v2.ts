import { extractRootMessage, proxyActivities } from '@mannercode/temporal-sandbox'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'

// 검증·생성은 sagaId를 멱등 키로 사용하므로 일시적인 워커/네트워크 장애 뒤 다시 실행해도 안전하다.
// heartbeat로 멈춘 시도를 빠르게 감지하고, 구독자의 5분 제한 안에서 모든 시도와 재시도를 끝낸다.
const { validateAndCreate } = proxyActivities<ReturnType<ShowtimeCreationActivities['bind']>>({
    heartbeatTimeout: '30 seconds',
    scheduleToCloseTimeout: '195 seconds',
    startToCloseTimeout: '1 minute',
    // 첫 worker가 lock을 쥔 채 죽어도 55초 TTL 뒤 남은 시도가 복구할 수 있어야 한다.
    retry: {
        initialInterval: '1 second',
        maximumAttempts: 4,
        nonRetryableErrorTypes: ['BadRequestException', 'NotFoundException']
    }
})

// 상태 알림은 같은 요청을 다시 실행해도 결과가 달라지지 않아 자동 재시도한다.
// 구독자는 사가 이벤트를 최대 5분 기다린다(race 테스트의 SSE_DEADLINE_MS).
// 일시적인 발행 지연이 그 안에 회복되도록 한 번의 제한 시간은 짧게, 재시도 간격은 빠르게 둔다.
const { emitStatusChanged } = proxyActivities<ReturnType<ShowtimeCreationActivities['bind']>>({
    scheduleToCloseTimeout: '35 seconds',
    startToCloseTimeout: '10 seconds',
    retry: { maximumAttempts: 3, initialInterval: '1 second' }
})

export async function showtimeCreationWorkflowV2(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태값은 다른 모듈의 타입과 맞춰 문자열로 직접 적는다.
    // 이 파일은 격리된 실행 환경에서 묶이므로, enum을 가져오다가 NestJS 코드까지 포함되면 빌드에 실패한다.
    await emitStatusChanged({ sagaId: input.sagaId, status: 'processing' })

    let result: Awaited<ReturnType<typeof validateAndCreate>>
    try {
        result = await validateAndCreate(input)
    } catch (error: unknown) {
        // 검증·생성은 한 MongoDB transaction이므로 실패한 시도의 부분 데이터는 커밋되지 않는다.
        await emitStatusChanged({
            message: extractRootMessage(error),
            sagaId: input.sagaId,
            status: 'error'
        })
        return
    }

    if (result.kind === 'succeeded') {
        await emitStatusChanged({
            createdShowtimeCount: result.createdShowtimeCount,
            createdTicketCount: result.createdTicketCount,
            sagaId: input.sagaId,
            status: 'succeeded'
        })
    } else {
        await emitStatusChanged({
            conflictingShowtimes: result.conflictingShowtimes,
            sagaId: input.sagaId,
            status: 'failed'
        })
    }
}
