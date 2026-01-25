import { MovieGenre, MovieRating } from 'apps/cores'
import type { UpsertMovieDto, MovieDto } from 'apps/cores'
import type { TestContext } from 'testlib'

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

    return createDto as UpsertMovieDto
}

export async function createMovie(ctx: TestContext, override = {}): Promise<MovieDto> {
    const { MoviesService } = await import('apps/cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create(createDto)
    await moviesService.publish(movie.id)
    return movie
}
