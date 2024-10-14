import { padNumber } from 'common'
import { MovieDto, MovieGenre, MovieRating } from 'services/movies'
import { createHttpTestContext, HttpTestClient, HttpTestContext, objectToFields } from 'testlib'
import { AppModule } from '../app.module'

export interface IsolatedFixture {
    testContext: HttpTestContext
}

export async function createIsolatedFixture() {
    const testContext = await createHttpTestContext({ imports: [AppModule] })

    return { testContext }
}

export async function closeIsolatedFixture(fixture: IsolatedFixture) {
    await fixture.testContext.close()
}

export const generateMovieDto = (overrides = {}) => {
    const creationDto = {
        title: `MovieTitle`,
        genre: [MovieGenre.Action],
        releaseDate: new Date('1900-01-01'),
        plot: `MoviePlot`,
        durationMinutes: 90,
        director: 'James Cameron',
        rating: MovieRating.PG,
        ...overrides
    }

    const expectedDto = { id: expect.anything(), images: expect.any(Array), ...creationDto }

    return { creationDto, expectedDto }
}

export const createMovie = async (client: HttpTestClient, override = {}) => {
    const { creationDto } = generateMovieDto(override)

    const { body } = await client
        .post('/movies')
        .attachs([{ name: 'files', file: './test/fixtures/image.png' }])
        .fields(objectToFields(creationDto))
        .created()

    return body
}

export const createMovies = async (client: HttpTestClient, overrides = {}) => {
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

            const promise = createMovie(client, { title, plot, genre, director, ...overrides })

            promises.push(promise)
        })
    })

    return Promise.all(promises)
}
