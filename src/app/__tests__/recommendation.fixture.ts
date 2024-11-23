import { MoviesService } from 'services/movies'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { WatchRecordsService } from 'services/watch-records'
import { ShowtimesService } from 'services/showtimes'

export interface Fixture {
    testContext: HttpTestContext
    moviesService: MoviesService
    watchRecordsService: WatchRecordsService
    showtimesService: ShowtimesService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const moviesService = testContext.module.get(MoviesService)
    const watchRecordsService = testContext.module.get(WatchRecordsService)
    const showtimesService = testContext.module.get(ShowtimesService)

    return { testContext, moviesService, watchRecordsService, showtimesService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
