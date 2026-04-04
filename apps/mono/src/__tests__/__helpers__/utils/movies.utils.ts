import type { TestContext } from '@mannercode/testing'
import { MovieGenre, MovieRating, MovieDto, UpsertMovieDto } from 'cores'

export function buildCreateMovieDto(overrides = {}) {
    const createDto = {
        assetIds: [] as string[],
        director: 'Quentin Tarantino',
        durationInSeconds: 90 * 60,
        genres: [MovieGenre.Action],
        plot: `MoviePlot`,
        rating: MovieRating.PG,
        releaseDate: new Date(0),
        title: `MovieTitle`,
        ...overrides
    }

    return createDto as UpsertMovieDto
}

export async function createMovie(ctx: TestContext, override = {}): Promise<MovieDto> {
    const { MoviesService } = await import('cores')
    const moviesService = ctx.module.get(MoviesService)

    const createDto = buildCreateMovieDto(override)

    const movie = await moviesService.create(createDto)
    await moviesService.publish(movie.id)
    return movie
}
