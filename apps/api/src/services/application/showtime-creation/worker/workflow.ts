import { extractRootMessage, proxyActivities } from '@mannercode/temporal-sandbox'
import type { ShowtimeCreationActivities } from './activities'
import type { ShowtimeCreationWorkflowInput } from './types'

// 검증 후 생성하는 작업은 중간에 실패한 뒤 다시 실행하면 중복 생성될 수 있어
// 자동 재시도를 끈다. 잠금 대기는 최대 10분이므로 실행 제한 시간은 더 길게 둔다.
const { validateAndCreate } = proxyActivities<ReturnType<ShowtimeCreationActivities['bind']>>({
    startToCloseTimeout: '15 minutes',
    retry: { maximumAttempts: 1 }
})

// 상태 알림과 실패 정리는 같은 요청을 다시 실행해도 결과가 달라지지 않아
// 자동 재시도한다. 일시적인 지연은 이벤트 대기 시간 5분 안에 회복되도록
// 한 번의 제한 시간은 짧게, 재시도 간격은 빠르게 둔다.
const { compensate, emitStatusChanged } = proxyActivities<
    ReturnType<ShowtimeCreationActivities['bind']>
>({ startToCloseTimeout: '30 seconds', retry: { maximumAttempts: 3, initialInterval: '1 second' } })

export async function showtimeCreationWorkflow(
    input: ShowtimeCreationWorkflowInput
): Promise<void> {
    // 상태값은 다른 모듈의 타입과 맞춰 문자열로 직접 적는다. 이 파일은 격리된
    // 실행 환경에서 묶이므로, enum을 가져오다가 NestJS 코드까지 포함되면 빌드에 실패한다.
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
