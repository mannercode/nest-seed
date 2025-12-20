import { ShowtimeCreationClient, ShowtimeCreationModule } from 'apps/applications'
import {
    MoviesClient,
    MoviesModule,
    ShowtimesClient,
    ShowtimesModule,
    TheatersClient,
    TheatersModule,
    TicketsClient,
    TicketsModule
} from 'apps/cores'
import { ShowtimeCreationController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { jsonToObject } from 'common'
import type { AppTestContext as TestContext } from '../__helpers__'
import { createAppTestContext } from '../__helpers__'

export type ShowtimeCreationFixture = TestContext & {
    showtimesClient: ShowtimesClient
    ticketsClient: TicketsClient
}

export async function createShowtimeCreationFixture(): Promise<ShowtimeCreationFixture> {
    const ctx = await createAppTestContext({
        imports: [
            MoviesModule,
            AssetsModule,
            TheatersModule,
            ShowtimesModule,
            TicketsModule,
            ShowtimeCreationModule
        ],
        providers: [
            MoviesClient,
            TheatersClient,
            ShowtimesClient,
            TicketsClient,
            ShowtimeCreationClient,
            AssetsClient
        ],
        controllers: [ShowtimeCreationController]
    })

    const showtimesClient = ctx.module.get(ShowtimesClient)
    const ticketsClient = ctx.module.get(TicketsClient)

    return { ...ctx, showtimesClient, ticketsClient }
}

export function waitForCompletion(ctx: TestContext, status: string) {
    return new Promise<any>((resolve, reject) => {
        ctx.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const result = jsonToObject(JSON.parse(data))

                if (['succeeded', 'failed', 'error'].includes(result.status)) {
                    ctx.httpClient.abort()

                    if (status === result.status) {
                        resolve(result)
                    } else {
                        reject(result)
                    }
                }
            } catch (error) {
                ctx.httpClient.abort()
                reject(error)
            }
        }, reject)
    })
}
