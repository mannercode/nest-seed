import { MovieGenre, MovieRating } from 'apps/cores'
import { CommonFixture } from '../__helpers__'
import { fixtureFiles } from './fixture-files'

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

export const createMovie = async (fix: CommonFixture, override = {}) => {
    const createDto = buildCreateMovieDto(override)

    const movie = await fix.moviesService.createMovie(createDto, [fixtureFiles.image])
    return movie
}
