import { ShowtimeCreationModule } from 'applications'
import { isDateString } from 'class-validator'
import { ShowtimeCreationHttpController } from 'controllers'
import {
    MoviesModule,
    ShowtimesModule,
    ShowtimesService,
    TheatersModule,
    TicketsModule,
    TicketsService
} from 'cores'
import { AssetsModule } from 'infrastructures'
import type { AppTestContext as TestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type ShowtimeCreationFixture = TestContext & {
    showtimesService: ShowtimesService
    ticketsService: TicketsService
}

export async function createShowtimeCreationFixture(): Promise<ShowtimeCreationFixture> {
    const ctx = await createAppTestContext({
        controllers: [ShowtimeCreationHttpController],
        imports: [
            MoviesModule,
            AssetsModule,
            TheatersModule,
            ShowtimesModule,
            TicketsModule,
            ShowtimeCreationModule
        ]
    })

    const showtimesService = ctx.module.get(ShowtimesService)
    const ticketsService = ctx.module.get(TicketsService)

    return { ...ctx, showtimesService, ticketsService }
}

export function waitForCompletion(ctx: TestContext, status: string) {
    return new Promise<any>((resolve, reject) => {
        ctx.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const statusUpdate = JSON.parse(data, (_key, value) =>
                    isDateString(value) ? new Date(value) : value
                )

                if (['error', 'failed', 'succeeded'].includes(statusUpdate.status)) {
                    ctx.httpClient.abort()

                    if (status === statusUpdate.status) {
                        resolve(statusUpdate)
                    } else {
                        reject(statusUpdate)
                    }
                }
            } catch (error) {
                ctx.httpClient.abort()
                reject(error)
            }
        }, reject)
    })
}
