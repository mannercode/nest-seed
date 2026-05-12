import { extractRootMessage, proxyActivities } from '@mannercode/temporal-sandbox'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'

const { compensate, emitStatusChanged, validateAndCreate } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({
    // 검증·삽입 락은 해제될 때까지 최대 10분(`waitMs`)을 기다립니다. 액티비티
    // 타임아웃을 그보다 길게 설정해야, 락 대기 중에 Temporal이 액티비티를 먼저
    // 끊지 않습니다.
    startToCloseTimeout: '15 minutes',
    // 자동 재시도는 비활성화합니다. 액티비티가 실패하면 워크플로우의 catch 블록이
    // 보상 액티비티를 부르고 실패 이벤트를 발행합니다. 재시도하면 같은 부수
    // 효과가 두 번 일어납니다.
    retry: { maximumAttempts: 1 }
})

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태 문자열은 `internal/types.ts`의 `ShowtimeCreationStatus`와 같은
    // 값을 사용합니다. enum 상수를 import 하지 않고 문자열을 직접 적는 이유는,
    // 워크플로우 코드가 샌드박스 안에서 실행되기 때문입니다. 형제 모듈을 따라
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
