import { MovieGenre, MovieRating } from 'apps/cores'
import { AssetsClient } from 'apps/infrastructures'
import { readFile } from 'fs/promises'
import { TestContext } from 'testlib'
import { fixtureFiles } from '../fixture-files'
import { ensureS3Bucket } from './assets.utils'

export const buildCreateMovieDto = (overrides = {}) => {
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

export const createMovie = async ({ module }: TestContext, override = {}) => {
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

const uploadMovieImage = async (assetsService: AssetsClient) => {
    await ensureS3Bucket()

    const uploadInfo = await assetsService.create({
        originalName: fixtureFiles.image.originalName,
        mimeType: fixtureFiles.image.mimeType,
        size: fixtureFiles.image.size,
        checksum: fixtureFiles.image.checksum
    })

    const uploadRes = await fetch(uploadInfo.uploadRequest.url, {
        method: uploadInfo.uploadRequest.method,
        headers: uploadInfo.uploadRequest.headers,
        body: await readFile(fixtureFiles.image.path)
    })

    if (!uploadRes.ok) {
        throw new Error(`Failed to upload asset ${uploadInfo.assetId}`)
    }

    return uploadInfo.assetId
}
