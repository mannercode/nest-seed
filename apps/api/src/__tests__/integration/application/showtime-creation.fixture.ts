import { JsonUtil } from '@mannercode/common'
import { ShowtimesService, TicketsService } from 'core'
import { createAppTestContext, type AppTestContext } from '../helpers'

export type ShowtimeCreationFixture = AppTestContext & {
    showtimesService: ShowtimesService
    ticketsService: TicketsService
}

export async function createShowtimeCreationFixture(): Promise<ShowtimeCreationFixture> {
    const ctx = await createAppTestContext()

    const showtimesService = ctx.module.get(ShowtimesService)
    const ticketsService = ctx.module.get(TicketsService)

    return { ...ctx, showtimesService, ticketsService }
}

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
