import { MovieGenre, MovieRating } from 'apps/cores'
import { TestContext } from 'testlib'
import { fixtureFiles } from '../fixture-files'

export const buildCreateMovieDto = (overrides = {}) => {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date(0),
        plot: `MoviePlot`,
        durationInSeconds: 90 * 60,
        director: 'Quentin Tarantino',
        rating: MovieRating.PG,
        ...overrides
    }

    return createDto
}

export const createMovie = async ({ module }: TestContext, override = {}) => {
    const { MoviesClient } = await import('apps/cores')
    const moviesService = module.get(MoviesClient)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.createMovie(createDto, [fixtureFiles.image])
    return movie
}
