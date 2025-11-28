import { MovieGenre, MovieRating } from 'apps/cores'
import { AttachmentsClient } from 'apps/infrastructures'
import { readFile } from 'fs/promises'
import { TestContext } from 'testlib'
import { fixtureFiles } from '../fixture-files'
import { ensureS3Bucket } from './attachments.utils'

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

    const { AttachmentsClient } = await import('apps/infrastructures')
    const attachmentsService = module.get(AttachmentsClient)

    const createDto = buildCreateMovieDto(override)

    if (!('imageFileIds' in createDto) || !createDto.imageFileIds?.length) {
        const imageFileId = await uploadMovieImage(attachmentsService)
        createDto.imageFileIds = [imageFileId]
    }

    const movie = await moviesService.create(createDto)
    movie.imageUrl = expect.any(String)
    movie.imageUrls = expect.any(Array)
    return movie
}

const uploadMovieImage = async (attachmentsService: AttachmentsClient) => {
    await ensureS3Bucket()

    const uploadInfo = await attachmentsService.create({
        originalName: fixtureFiles.image.originalName,
        mimeType: fixtureFiles.image.mimeType,
        size: fixtureFiles.image.size,
        checksum: fixtureFiles.image.checksum.value
    })

    const uploadRes = await fetch(uploadInfo.uploadUrl, {
        method: uploadInfo.method,
        headers: uploadInfo.headers,
        body: await readFile(fixtureFiles.image.path)
    })

    if (!uploadRes.ok) {
        throw new Error(`Failed to upload attachment ${uploadInfo.attachmentId}`)
    }

    return uploadInfo.attachmentId
}
