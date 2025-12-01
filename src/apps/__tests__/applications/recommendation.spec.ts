import { MovieDto, MovieGenre } from 'apps/cores'
import {
    createShowingMovies,
    createWatchedMovies,
    type RecommendationFixture
} from './recommendation.fixture'

describe('RecommendationService', () => {
    let fixture: RecommendationFixture

    beforeEach(async () => {
        const { createRecommendationFixture } = await import('./recommendation.fixture')
        fixture = await createRecommendationFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('GET /movies/recommended', () => {
        let showingMovies: MovieDto[]
        const expectMovie = (movie: MovieDto) =>
            expect.objectContaining({
                id: movie.id,
                title: movie.title,
                genres: movie.genres,
                releaseDate: movie.releaseDate,
                plot: movie.plot,
                durationInSeconds: movie.durationInSeconds,
                director: movie.director,
                rating: movie.rating,
                imageAssetIds: movie.imageAssetIds,
                imageUrl: expect.any(String),
                imageUrls: expect.any(Array)
            })

        beforeEach(async () => {
            const { movies } = await createShowingMovies(fixture, [
                {
                    title: 'Fantasy',
                    genres: [MovieGenre.Fantasy],
                    releaseDate: new Date('2900-01-01')
                },
                {
                    title: 'Comedy1',
                    genres: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-02-01')
                },
                {
                    title: 'Comedy2',
                    genres: [MovieGenre.Comedy],
                    releaseDate: new Date('2900-03-01')
                },
                {
                    title: 'Action',
                    genres: [MovieGenre.Action],
                    releaseDate: new Date('2900-04-01')
                },
                { title: 'Drama', genres: [MovieGenre.Drama], releaseDate: new Date('2900-05-01') }
            ])

            showingMovies = movies
        })

        describe('when the user is a customer', () => {
            let accessToken: string

            beforeEach(async () => {
                const result = await createWatchedMovies(fixture, [
                    { title: 'Action1', genres: [MovieGenre.Action] },
                    { title: 'Action2', genres: [MovieGenre.Action] },
                    { title: 'Action3', genres: [MovieGenre.Action] },
                    { title: 'Comedy1', genres: [MovieGenre.Comedy] },
                    { title: 'Comedy2', genres: [MovieGenre.Comedy] },
                    { title: 'Drama1', genres: [MovieGenre.Drama] }
                ])

                accessToken = result.accessToken
            })

            it('returns recommendations for the customer', async () => {
                await fixture.httpClient
                    .get('/movies/recommended')
                    .headers({ Authorization: `Bearer ${accessToken}` })
                    .ok([
                        expectMovie(showingMovies[3]), // Action
                        expectMovie(showingMovies[2]), // Comedy2, 2900-03-01
                        expectMovie(showingMovies[1]), // Comedy1, 2900-02-01
                        expectMovie(showingMovies[4]), // Drama
                        expectMovie(showingMovies[0]) // Fantasy
                    ])
            })
        })

        describe('when the user is a guest', () => {
            it('returns recommendations for guests', async () => {
                await fixture.httpClient.get('/movies/recommended').ok([
                    expectMovie(showingMovies[4]), // 2900-05-01
                    expectMovie(showingMovies[3]), // 2900-04-01
                    expectMovie(showingMovies[2]), // 2900-03-01
                    expectMovie(showingMovies[1]), // 2900-02-01
                    expectMovie(showingMovies[0]) // 2900-01-01
                ])
            })
        })
    })
})
