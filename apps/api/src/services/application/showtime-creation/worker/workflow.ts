import { extractRootMessage, proxyActivities } from '@mannercode/temporal-sandbox'
import type { LegacyShowtimeCreationActivities } from './legacy-activities'
import type { LegacyShowtimeCreationWorkflowInput } from './legacy-types'

// 이 v1 정의는 이미 실행 중인 Temporal history를 재생하기 위한 호환 코드다.
// timeout/retry/activity command를 바꾸면 결정성이 깨지므로 v1 queue가 완전히 drain될 때까지 동결한다.
const { validateAndCreate } = proxyActivities<ReturnType<LegacyShowtimeCreationActivities['bind']>>(
    { startToCloseTimeout: '15 minutes', retry: { maximumAttempts: 1 } }
)

const { compensate } = proxyActivities<ReturnType<LegacyShowtimeCreationActivities['bind']>>({
    startToCloseTimeout: '15 minutes',
    retry: { maximumAttempts: 3, initialInterval: '1 second' }
})

// 상태 알림은 같은 요청을 다시 실행해도 결과가 달라지지 않아 자동 재시도한다.
// 구독자는 사가 이벤트를 최대 5분 기다린다(race 테스트의 SSE_DEADLINE_MS).
// 일시적인 발행 지연이 그 안에 회복되도록 한 번의 제한 시간은 짧게, 재시도 간격은 빠르게 둔다.
const { emitStatusChanged } = proxyActivities<ReturnType<LegacyShowtimeCreationActivities['bind']>>(
    {
        startToCloseTimeout: '30 seconds',
        retry: { maximumAttempts: 3, initialInterval: '1 second' }
    }
)

export async function showtimeCreationWorkflow(
    input: LegacyShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태값은 다른 모듈의 타입과 맞춰 문자열로 직접 적는다.
    // 이 파일은 격리된 실행 환경에서 묶이므로, enum을 가져오다가 NestJS 코드까지 포함되면 빌드에 실패한다.
    await emitStatusChanged({ sagaId: input.sagaId, status: 'processing' })

    try {
        const result = await validateAndCreate(input)

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
    } catch (error: unknown) {
        await compensate(input.sagaId)
        await emitStatusChanged({
            message: extractRootMessage(error),
            sagaId: input.sagaId,
            status: 'error'
        })
    }
}
