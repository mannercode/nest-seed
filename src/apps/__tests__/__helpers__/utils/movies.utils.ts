import { CreateMovieDto, MovieDto, MovieGenre, MovieRating } from 'apps/cores'
import { TestContext } from 'testlib'

export function buildCreateMovieDto(overrides = {}) {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date(0),
        plot: `MoviePlot`,
        durationInSeconds: 90 * 60,
        director: 'Quentin Tarantino',
        rating: MovieRating.PG,
        assetIds: [] as string[],
        ...overrides
    }

    return createDto as CreateMovieDto
}

export async function createMovie(ctx: TestContext, override = {}): Promise<MovieDto> {
    const { MoviesClient } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesClient)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create(createDto)
    return movie
}
