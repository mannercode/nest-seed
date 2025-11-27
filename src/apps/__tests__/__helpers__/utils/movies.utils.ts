import { MovieGenre, MovieRating } from 'apps/cores'
import { StorageFilesClient } from 'apps/infrastructures'
import { readFile } from 'fs/promises'
import { TestContext } from 'testlib'
import { fixtureFiles } from '../fixture-files'
import { ensureS3Bucket } from './storage-files.utils'

export const buildCreateMovieDto = (overrides = {}) => {
    const createDto = {
        title: `MovieTitle`,
        genres: [MovieGenre.Action],
        releaseDate: new Date(0),
        plot: `MoviePlot`,
        durationInSeconds: 90 * 60,
        director: 'Quentin Tarantino',
        rating: MovieRating.PG,
        imageFileIds: [] as string[],
        ...overrides
    }

    return createDto
}

export const createMovie = async ({ module }: TestContext, override = {}) => {
    const { MoviesClient } = await import('apps/cores')
    const moviesService = module.get(MoviesClient)

    const { StorageFilesClient } = await import('apps/infrastructures')
    const storageFilesService = module.get(StorageFilesClient)

    const createDto = buildCreateMovieDto(override)

    if (!('imageFileIds' in createDto) || !createDto.imageFileIds?.length) {
        const imageFileId = await uploadMovieImage(storageFilesService)
        createDto.imageFileIds = [imageFileId]
    }

    const movie = await moviesService.create(createDto)
    movie.imageUrl = expect.any(String)
    movie.imageUrls = expect.any(Array)
    return movie
}

const uploadMovieImage = async (storageFilesService: StorageFilesClient) => {
    await ensureS3Bucket()

    const presign = await storageFilesService.presignUploadUrl({
        originalName: fixtureFiles.image.originalName,
        mimeType: fixtureFiles.image.mimeType,
        size: fixtureFiles.image.size,
        checksum: fixtureFiles.image.checksum.value
    })

    const uploadRes = await fetch(presign.uploadUrl, {
        method: presign.method,
        headers: presign.headers,
        body: await readFile(fixtureFiles.image.path)
    })

    if (!uploadRes.ok) {
        throw new Error(`Failed to upload storage file ${presign.storageFile.id}`)
    }

    return presign.storageFile.id
}
