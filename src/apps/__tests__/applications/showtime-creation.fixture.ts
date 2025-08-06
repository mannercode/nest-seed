import { ShowtimeCreationClient, ShowtimeCreationModule } from 'apps/applications'
import {
    MovieDto,
    MoviesClient,
    MoviesModule,
    ShowtimesClient,
    ShowtimesModule,
    TheaterDto,
    TheatersClient,
    TheatersModule,
    TicketsModule
} from 'apps/cores'
import { ShowtimeCreationController } from 'apps/gateway'
import { StorageFilesModule } from 'apps/infrastructures'
import { jsonToObject, notUsed } from 'common'
import { HttpTestClient } from 'testlib'
import { createMovie2, createTestFixture, createTheater2, TestFixture } from '../__helpers__'

export const monitorEvents = (client: HttpTestClient, waitStatuses: string[]) => {
    return new Promise((resolve, reject) => {
        client.get('/showtime-creation/event-stream').sse((data) => {
            const result = jsonToObject(JSON.parse(data))

            if (['waiting', 'processing'].includes(result.status)) {
                notUsed('Ignore incomplete statuses')
            } else if (['succeeded', 'failed', 'error'].includes(result.status)) {
                if (waitStatuses.includes(result.status)) {
                    resolve(result)
                } else {
                    reject(result)
                }
            } else {
                reject(data)
            }
        }, reject)
    })
}

export interface Fixture extends TestFixture {
    movie: MovieDto
    theater: TheaterDto
}

export const createFixture = async (): Promise<Fixture> => {
    const fix = await createTestFixture({
        imports: [
            MoviesModule,
            StorageFilesModule,
            TheatersModule,
            ShowtimesModule,
            TicketsModule,
            ShowtimeCreationModule
        ],
        providers: [MoviesClient, TheatersClient, ShowtimesClient, ShowtimeCreationClient],
        controllers: [ShowtimeCreationController]
    })

    const movie = await createMovie2(fix)
    const theater = await createTheater2(fix)

    return { ...fix, movie, theater }
}
