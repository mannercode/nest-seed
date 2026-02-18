import { createAppTestContext } from 'apps/__tests__/__helpers__'
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
import { reviveIsoDates } from 'common'
import type { AppTestContext as TestContext } from 'apps/__tests__/__helpers__'

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
                const statusUpdate = reviveIsoDates(JSON.parse(data))

                if (['succeeded', 'failed', 'error'].includes(statusUpdate.status)) {
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
