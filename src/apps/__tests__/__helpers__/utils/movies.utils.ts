import { MovieGenre, MovieRating } from 'apps/cores'
import { AssetsClient } from 'apps/infrastructures'
import { createReadStream } from 'fs'
import { TestContext } from 'testlib'
import { fixtureFiles } from '../fixture-files'

export function buildCreateMovieDto(overrides = {}) {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date(0),
        plot: `MoviePlot`,
        durationInSeconds: 90 * 60,
        director: 'Quentin Tarantino',
        rating: MovieRating.PG,
        imageAssetIds: [] as string[],
        ...overrides
    }

    return createDto
}

export async function createMovie({ module }: TestContext, override = {}) {
    const { MoviesClient } = await import('apps/cores')
    const moviesService = module.get(MoviesClient)

    const { AssetsClient } = await import('apps/infrastructures')
    const assetsService = module.get(AssetsClient)

    const createDto = buildCreateMovieDto(override)

    if (!('imageAssetIds' in createDto) || !createDto.imageAssetIds?.length) {
        const imageAssetId = await uploadMovieImage(assetsService)
        createDto.imageAssetIds = [imageAssetId]
    }

    const movie = await moviesService.create(createDto)
    movie.imageUrl = expect.any(String)
    movie.imageUrls = expect.any(Array)
    return movie
}

async function uploadMovieImage(assetsService: AssetsClient) {
    const { assetId, url, method, headers } = await assetsService.create({
        originalName: fixtureFiles.image.originalName,
        mimeType: fixtureFiles.image.mimeType,
        size: fixtureFiles.image.size,
        checksum: fixtureFiles.image.checksum
    })

    const stream = createReadStream(fixtureFiles.image.path)

    const uploadResponse = await fetch(url, { method, headers, body: stream, duplex: 'half' })

    if (!uploadResponse.ok) {
        throw new Error(`Failed to upload asset ${assetId}`)
    }

    return assetId
}
