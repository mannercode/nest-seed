import type { AppTestContext as TestContext } from 'apps/__tests__/__helpers__'
import { Json } from '@mannercode/nestlib-common'
import { createAppTestContext, createTemporalTestWorker } from 'apps/__tests__/__helpers__'
import {
    createShowtimeCreationActivities,
    ShowtimeBulkCreatorService,
    ShowtimeBulkValidatorService,
    ShowtimeCreationClient,
    ShowtimeCreationEvents,
    ShowtimeCreationModule
} from 'apps/applications'
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
import { ShowtimeCreationHttpController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'

export type ShowtimeCreationFixture = TestContext & {
    showtimesClient: ShowtimesClient
    ticketsClient: TicketsClient
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
        ],
        providers: [
            MoviesClient,
            TheatersClient,
            ShowtimesClient,
            TicketsClient,
            ShowtimeCreationClient,
            AssetsClient
        ]
    })

    const showtimesClient = ctx.module.get(ShowtimesClient)
    const ticketsClient = ctx.module.get(TicketsClient)

    const showtimeCreationActivities = createShowtimeCreationActivities({
        validatorService: ctx.module.get(ShowtimeBulkValidatorService),
        creatorService: ctx.module.get(ShowtimeBulkCreatorService),
        events: ctx.module.get(ShowtimeCreationEvents),
        showtimesClient,
        ticketsClient,
        reviveIsoDates: Json.reviveIsoDates
    })

    const temporalWorker = await createTemporalTestWorker({
        activities: showtimeCreationActivities
    })

    const originalTeardown = ctx.teardown

    return {
        ...ctx,
        showtimesClient,
        ticketsClient,
        teardown: async () => {
            await temporalWorker.shutdown()
            await originalTeardown()
        }
    }
}

export function waitForCompletion(ctx: TestContext, status: string) {
    return new Promise<any>((resolve, reject) => {
        ctx.httpClient.get('/showtime-creation/event-stream').sse((data) => {
            try {
                const statusUpdate = Json.reviveIsoDates(JSON.parse(data))

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
