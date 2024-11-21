import { MovieDto } from 'services/movies'
import { ShowtimesService } from 'services/showtimes'
import { TheaterDto } from 'services/theaters'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { createMovie } from './movies.fixture'


export interface Fixture {
    testContext: HttpTestContext
    showtimesService: ShowtimesService
    movie: MovieDto
    theater: TheaterDto
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const showtimesService = testContext.module.get(ShowtimesService)

    // TODO 테스트 대상은 client로 요청하는 게 맞다.
    // 그러나 그 외 fixture는 service나 repository로 직접 생성해야 한다
    // client로 하면 얽히는 게 많아진다. 변화에 취약하다.
    const movie = await createMovie(testContext.client)

    return { testContext, showtimesService, movie }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
