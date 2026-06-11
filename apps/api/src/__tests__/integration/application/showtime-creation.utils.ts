import { JsonUtil } from '@mannercode/common'
import { HttpTestClient } from '@mannercode/testing'
import type { AppTestContext } from '../helpers'

export function waitForCompletion(ctx: AppTestContext, status: string) {
    // 공유 httpClient는 다른 요청이 끼어들면 abort 대상이 SSE 스트림이 아니게 된다.
    // 스트림 전용 클라이언트를 만들어 abort가 항상 이 구독을 가리키게 한다.
    const sseClient = new HttpTestClient(ctx.httpClient.serverUrl)

    return new Promise<any>((resolve, reject) => {
        sseClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const statusUpdate = JsonUtil.parse(data)

                if (['error', 'failed', 'succeeded'].includes(statusUpdate.status)) {
                    sseClient.abort()

                    if (status === statusUpdate.status) {
                        resolve(statusUpdate)
                    } else {
                        reject(
                            new Error(`unexpected status: ${statusUpdate.status}`, {
                                cause: statusUpdate
                            })
                        )
                    }
                }
            } catch (error) {
                sseClient.abort()
                reject(error instanceof Error ? error : new Error(String(error)))
            }
        }, reject)
    })
}
