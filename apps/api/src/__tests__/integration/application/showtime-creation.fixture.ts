import { JsonUtil } from '@mannercode/common'
import type { AppTestContext } from '../helpers'

export function waitForCompletion(ctx: AppTestContext, status: string) {
    return new Promise<any>((resolve, reject) => {
        ctx.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const statusUpdate = JsonUtil.parse(data)

                if (['error', 'failed', 'succeeded'].includes(statusUpdate.status)) {
                    ctx.httpClient.abort()

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
                ctx.httpClient.abort()
                reject(error instanceof Error ? error : new Error(String(error)))
            }
        }, reject)
    })
}
