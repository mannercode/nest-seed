import { AppModule } from 'app/app.module'
import { configureApp } from 'app/main'
import { padNumber } from 'common'
import { MovieDto, MovieGenre, MovieRating, MoviesService } from 'services/cores'
import { createHttpTestContext, HttpTestContext } from 'testlib'

export interface Fixture {
    testContext: HttpTestContext
    moviesService: MoviesService
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] }, configureApp)
    const moviesService = testContext.module.get(MoviesService)

    return { testContext, moviesService }
}

export async function closeFixture(fixture: Fixture) {
    await fixture.testContext.close()
}

export const createMovieDto = (overrides = {}) => {
    const createDto = {
        title: `MovieTitle`,
        genre: [MovieGenre.Action],
        releaseDate: new Date('1900-01-01'),
        plot: `MoviePlot`,
        durationMinutes: 90,
        director: 'James Cameron',
        rating: MovieRating.PG,
        ...overrides
    }

    const expectedDto = { id: expect.any(String), images: expect.any(Array), ...createDto }

    return { createDto, expectedDto }
}

export const createMovie = async (moviesService: MoviesService, override = {}) => {
    const { createDto } = createMovieDto(override)
    const movie = await moviesService.createMovie(createDto, [])
    return movie
}

export const createMovies = async (moviesService: MoviesService, overrides = {}) => {
    const promises: Promise<MovieDto>[] = []

    const genres = [
        [MovieGenre.Action, MovieGenre.Comedy],
        [MovieGenre.Romance, MovieGenre.Drama],
        [MovieGenre.Thriller, MovieGenre.Western]
    ]
    const directors = ['James Cameron', 'Steven Spielberg']
    let i = 0

    genres.map((genre) => {
        directors.map((director) => {
            const tag = padNumber(i++, 3)
            const title = `title-${tag}`
            const plot = `plot-${tag}`

            const promise = createMovie(moviesService, {
                title,
                plot,
                genre,
                director,
                ...overrides
            })

            promises.push(promise)
        })
    })

    return Promise.all(promises)
}
