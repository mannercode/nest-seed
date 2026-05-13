import { extractRootMessage, proxyActivities } from '@mannercode/temporal-sandbox'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'

// 검증·삽입은 멱등하지 않으므로 재시도하지 않습니다. 검증·삽입 락이 해제될
// 때까지 최대 10분(`waitMs`)을 기다리므로 타임아웃을 그보다 길게 둡니다.
const { validateAndCreate } = proxyActivities<ReturnType<ShowtimeCreationActivities['bind']>>({
    startToCloseTimeout: '15 minutes',
    retry: { maximumAttempts: 1 }
})

// NATS 발행과 보상 삭제는 멱등합니다(같은 `sagaId`의 같은 `status` 이벤트를
// 두 번 받아도 SSE 검증은 some()으로 첫 매치를 보고, deleteBySagaIds는 두 번
// 호출해도 결과가 같습니다). Temporal 워커의 일시적 작업 수신 지연이 5분짜리
// SSE 대기 시간 안에서 회복되도록 짧은 타임아웃과 빠른 재시도로 둡니다.
const { compensate, emitStatusChanged } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({ startToCloseTimeout: '30 seconds', retry: { maximumAttempts: 3, initialInterval: '1 second' } })

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태 문자열은 `internal/types.ts`의 `ShowtimeCreationStatus`와 같은
    // 값을 사용합니다. enum 상수를 가져오지 않고 문자열을 직접 적는 이유는,
    // 워크플로 코드가 샌드박스 안에서 실행되기 때문입니다. 형제 모듈을 따라
    // `@nestjs/common`의 데코레이터가 함께 포함되면 번들이 실패합니다.
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
