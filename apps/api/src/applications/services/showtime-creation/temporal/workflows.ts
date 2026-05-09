import { proxyActivities } from '@temporalio/workflow'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'
import { extractRootMessage } from './extract-root-message'

const { compensate, emitStatusChanged, validateAndCreate } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({
    // validate+create lock 은 throw 전까지 최대 10 분 (`waitMs`) 까지 대기할 수
    // 있으므로, activity timeout 을 그 위로 잡아 spurious cancellation 없이
    // worst case 를 흡수한다.
    startToCloseTimeout: '15 minutes',
    // 자동 retry 하지 않는다 — workflow 의 catch 블록이 compensate 를 실행하고
    // Error 상태를 노출한다. retry 하면 side effect 가 중복 발생한다.
    retry: { maximumAttempts: 1 }
})

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // status 문자열은 services/types.ts 의 ShowtimeCreationStatus union 과 일치한다.
    // const 객체를 import 하지 않는 이유: workflow 코드는 sandbox 에서 실행되는데
    // 형제 모듈이 transitive 로 `@nestjs/common` decorator 를 가져오는 순간 Webpack
    // 번들링이 깨진다.
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
