import { proxyActivities } from '@temporalio/workflow'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'
import { extractRootMessage } from './extract-root-message'

const { compensate, emitStatusChanged, validateAndCreate } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({
    // 검증·삽입 락은 풀릴 때까지 최대 10 분(`waitMs`)을 기다린다. 액티비티
    // 타임아웃을 그 위로 잡아야, 락 대기 중에 Temporal 이 액티비티를 먼저
    // 끊지 않는다.
    startToCloseTimeout: '15 minutes',
    // 자동 재시도는 끈다. 액티비티가 실패하면 워크플로우의 catch 블록이
    // 보상 액티비티를 부르고 실패 이벤트를 발행한다. 재시도하면 같은 부수
    // 효과가 두 번 일어난다.
    retry: { maximumAttempts: 1 }
})

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태 문자열은 `internal/types.ts` 의 `ShowtimeCreationStatus` 와 같은
    // 값을 쓴다. enum 상수를 import 하지 않고 문자열을 직접 적는 이유는,
    // 워크플로우 코드가 샌드박스 안에서 돌기 때문이다. 형제 모듈을 따라
    // `@nestjs/common` 의 데코레이터가 같이 끌려오면 번들이 깨진다.
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
