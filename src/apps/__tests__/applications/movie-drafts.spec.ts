import { FileUtil, Path, DateUtil } from 'common'
import { HttpStatus } from '@nestjs/common'
import { createReadStream } from 'fs'
import { writeFile } from 'fs/promises'
import { nullObjectId } from 'testlib'
import { buildCreateMovieDto, Errors } from '../__helpers__'
import { MovieDraftsFixture } from './movie-drafts.fixture'

describe('MovieDraftsService', () => {
    let fix: MovieDraftsFixture

    beforeEach(async () => {
        const { createMovieDraftsFixture } = await import('./movie-drafts.fixture')
        fix = await createMovieDraftsFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    async function requestImageUpload(draftId: string) {
        const payload = {
            originalName: fix.image.originalName,
            mimeType: fix.image.mimeType,
            size: fix.image.size,
            checksum: fix.image.checksum
        }

        const { body: upload } = await fix.httpClient
            .post(`/movie-drafts/${draftId}/images`)
            .body(payload)
            .created()

        const uploadResponse = await fetch(upload.upload.url, {
            method: upload.upload.method,
            headers: upload.upload.headers,
            body: createReadStream(fix.image.path),
            duplex: 'half'
        })

        expect(uploadResponse.ok).toBe(true)
        return upload
    }

    describe('when uploading an image via presign and completing the draft', () => {
        it('creates a movie with the uploaded image', async () => {
            const { body: draft } = await fix.httpClient.post('/movie-drafts').created()

            const upload = await requestImageUpload(draft.id)

            await fix.httpClient
                .post(`/movie-drafts/${draft.id}/images/${upload.imageId}/complete`)
                .ok(expect.objectContaining({ id: upload.imageId, status: 'READY' }))

            const { assetIds: _ignored, ...updateDto } = buildCreateMovieDto({
                title: 'draft title',
                plot: 'draft plot'
            })

            await fix.httpClient
                .patch(`/movie-drafts/${draft.id}`)
                .body(updateDto)
                .ok(expect.objectContaining({ id: draft.id, ...updateDto }))

            const { body: createdMovie } = await fix.httpClient
                .post(`/movie-drafts/${draft.id}/complete`)
                .created()

            expect(createdMovie).toEqual(
                expect.objectContaining({
                    id: expect.any(String),
                    ...updateDto,
                    imageUrls: [expect.any(String)]
                })
            )

            await fix.httpClient
                .get(`/movie-drafts/${draft.id}`)
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: draft.id })

            const downloadResponse = await fetch(createdMovie.imageUrls[0])
            expect(downloadResponse.ok).toBe(true)

            const downloadedBuffer = Buffer.from(await downloadResponse.arrayBuffer())
            const downloadPath = Path.join(fix.tempDir, 'draft-download.tmp')
            await writeFile(downloadPath, downloadedBuffer)

            expect(await FileUtil.areEqual(downloadPath, fix.image.path)).toBe(true)
        })
    })

    describe('when completing an incomplete draft', () => {
        it('returns 422 Unprocessable Entity', async () => {
            const { body: draft } = await fix.httpClient.post('/movie-drafts').created()

            await fix.httpClient
                .post(`/movie-drafts/${draft.id}/complete`)
                .send(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    expect.objectContaining(Errors.MovieDrafts.InvalidForCompletion)
                )
        })
    })

    describe('when updating and deleting a draft', () => {
        it('updates fields and deletes the draft', async () => {
            const { body: draft } = await fix.httpClient.post('/movie-drafts').created()
            await fix.httpClient
                .get(`/movie-drafts/${draft.id}`)
                .ok(expect.objectContaining({ id: draft.id, expiresAt: expect.any(Date) }))

            const { assetIds: _ignored, ...updateDto } = buildCreateMovieDto({
                title: 'updated title',
                plot: 'updated plot'
            })

            const { body: updated } = await fix.httpClient
                .patch(`/movie-drafts/${draft.id}`)
                .body(updateDto)
                .ok()

            expect(updated).toEqual(expect.objectContaining({ id: draft.id, ...updateDto }))

            await fix.httpClient.delete(`/movie-drafts/${draft.id}`).send(HttpStatus.NO_CONTENT)

            await fix.httpClient
                .get(`/movie-drafts/${draft.id}`)
                .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: draft.id })
        })
    })

    describe('when requesting image upload', () => {
        it('rejects unsupported mime types', async () => {
            const { body: draft } = await fix.httpClient.post('/movie-drafts').created()

            await fix.httpClient
                .post(`/movie-drafts/${draft.id}/images`)
                .body({
                    originalName: fix.image.originalName,
                    mimeType: 'text/plain',
                    size: fix.image.size,
                    checksum: fix.image.checksum
                })
                .badRequest(
                    expect.objectContaining({
                        ...Errors.MovieDrafts.UnsupportedImageType,
                        mimeType: 'text/plain'
                    })
                )
        })

        it('returns 404 when completing a non-existent image', async () => {
            const { body: draft } = await fix.httpClient.post('/movie-drafts').created()

            await fix.httpClient
                .post(`/movie-drafts/${draft.id}/images/${nullObjectId}/complete`)
                .notFound(
                    expect.objectContaining({
                        ...Errors.MovieDrafts.ImageNotFound,
                        imageId: nullObjectId
                    })
                )
        })
    })

    describe('when the draft is expired', () => {
        it('deletes and returns 404 on access', async () => {
            const expiresAt = DateUtil.add({ minutes: -5 })
            const draft = await fix.movieDraftsRepository.createDraft({ expiresAt })

            await fix.httpClient
                .get(`/movie-drafts/${draft.id}`)
                .notFound(expect.objectContaining(Errors.MovieDrafts.Expired))
        })
    })
})
