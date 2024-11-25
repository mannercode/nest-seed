import { addMinutes } from 'common'
import { CustomersService } from 'services/customers'
import { MovieDto, MoviesService } from 'services/movies'
import { ShowtimesService } from 'services/showtimes'
import { TheatersService } from 'services/theaters'
import { createHttpTestContext, HttpTestContext } from 'testlib'
import { AppModule, configureApp } from '../app.module'
import { createCustomerAndLogin } from './customers-auth.fixture'
import { createMovie } from './movies.fixture'
import { createShowtimeDto, createShowtimes } from './showtimes.fixture'
import { createTheater } from './theaters.fixture'

export interface Fixture {
    testContext: HttpTestContext
    movie: MovieDto
    accessToken: string
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)

    const customersService = testContext.module.get(CustomersService)
    const { accessToken } = await createCustomerAndLogin(customersService)

    const moviesService = testContext.module.get(MoviesService)
    const movie = await createMovie(moviesService, {})

    const theatersService = testContext.module.get(TheatersService)
    const theaters = await Promise.all(
        Array.from({ length: 10 }, (_, index) =>
            createTheater(theatersService, {
                latlong: { latitude: 30.0 + index, longitude: 130.0 + index }
            })
        )
    )

    const showtimesService = testContext.module.get(ShowtimesService)
    const startTimes = [
        new Date('2999-01-01T12:00'),
        new Date('2999-01-01T14:00'),
        new Date('2999-01-03T12:00'),
        new Date('2999-01-03T14:00'),
        new Date('2999-01-02T12:00'),
        new Date('2999-01-02T14:00')
    ]
    const showtimeDtos = theaters.slice(0, 5).flatMap((theater) =>
        startTimes.map((startTime) =>
            createShowtimeDto({
                movieId: movie.id,
                theaterId: theater.id,
                startTime,
                endTime: addMinutes(startTime, 90)
            })
        )
    )
    await createShowtimes(showtimesService, showtimeDtos)

    // TODO ticket 생성해서 상태 업데이트 해야한다
    return { testContext, movie, accessToken }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}
