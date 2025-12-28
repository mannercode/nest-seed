import { HttpStatus } from '@nestjs/common'
import { Checksum } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateAssetDto, buildCreateMovieDto, Errors, fixtureFiles } from '../__helpers__'
import { createMovieDraft, uploadDraftImage } from './movie-drafts.fixture'
import type { MovieDraftsFixture } from './movie-drafts.fixture'
import type { MovieDraftDto } from 'apps/applications'

describe('MovieDraftsService', () => {
    let fix: MovieDraftsFixture
    const imageFile = fixtureFiles.image

    beforeEach(async () => {
        const { createMovieDraftsFixture } = await import('./movie-drafts.fixture')
        fix = await createMovieDraftsFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movie-drafts', () => {
        it('returns the created movie-draft', async () => {
            await fix.httpClient
                .post('/movie-drafts')
                .created(expect.objectContaining({ id: expect.any(String) }))
        })
    })

    describe('GET /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('returns the movie-draft', async () => {
                await fix.httpClient.get(`/movie-drafts/${movieDraft.id}`).ok(movieDraft)
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/movie-drafts/${nullObjectId}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('PATCH /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('returns the updated movie-draft', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }

                await fix.httpClient
                    .patch(`/movie-drafts/${movieDraft.id}`)
                    .body(updateDto)
                    .ok({ ...movieDraft, ...updateDto })
            })

            it('persists the update', async () => {
                const updateDto = { title: 'update title' }
                await fix.httpClient.patch(`/movie-drafts/${movieDraft.id}`).body(updateDto).ok()

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .ok({ ...movieDraft, ...updateDto })
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/movie-drafts/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('POST /movie-drafts/:id/images', () => {
        describe('when the movie-draft exists', () => {
            it('creates an image slot and returns an S3 upload URL', async () => {
                const movieDraft = await createMovieDraft(fix)
                const createDto = buildCreateAssetDto(imageFile)

                const { body } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .created()

                expect(body).toEqual({
                    imageId: expect.any(String),
                    upload: expect.objectContaining({
                        assetId: expect.any(String),
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'PUT',
                        headers: expect.objectContaining({
                            'Content-Type': createDto.mimeType,
                            'Content-Length': createDto.size.toString(),
                            'x-amz-checksum-sha256': createDto.checksum.base64
                        })
                    })
                })

                expect(body.imageId).toBe(body.upload.assetId)
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                const createDto = buildCreateAssetDto(imageFile)

                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/images`)
                    .body(createDto)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })

        describe('when the image type is not supported', () => {
            it('returns 400 Bad Request', async () => {
                const movieDraft = await createMovieDraft(fix)
                const createDto = buildCreateAssetDto(fixtureFiles.json)

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .badRequest({
                        ...Errors.MovieDrafts.UnsupportedImageType,
                        mimeType: createDto.mimeType
                    })
            })
        })

        describe('when the `mimeType` is invalid', () => {
            it('returns 400 Bad Request', async () => {
                const movieDraft = await createMovieDraft(fix)
                const createDto = buildCreateAssetDto(imageFile, { mimeType: '' })

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .badRequest({ ...Errors.RequestValidation.Failed, details: expect.any(Array) })
            })
        })
    })

    describe('POST /movie-drafts/:draftId/images/:imageId/complete', () => {
        describe('when the movie-draft and image exist', () => {
            describe('when S3 upload succeeded', () => {
                let movieDraft: MovieDraftDto
                let upload: {
                    imageId: string
                    upload: { url: string; method: string; headers: any }
                }

                beforeEach(async () => {
                    movieDraft = await createMovieDraft(fix)
                    upload = await uploadDraftImage(fix, movieDraft.id)
                })

                it('marks the image as READY and returns 200 OK', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images/${upload.imageId}/complete`)
                        .ok({ id: upload.imageId, status: 'ready' })
                })

                it('movie-draft에 이미지를 포함한다', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images/${upload.imageId}/complete`)
                        .ok()

                    await fix.httpClient
                        .get(`/movie-drafts/${movieDraft.id}`)
                        .ok(expect.objectContaining({ assetIds: [upload.imageId] }))
                })
            })
        })

        describe('when the S3 validation fails', () => {
            it('returns 422 Unprocessable Entity', async () => {
                const movieDraft = await createMovieDraft(fix)
                const createDto = buildCreateAssetDto(imageFile)

                const { body } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .created()
                const upload = body

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${upload.imageId}/complete`)
                    .send(HttpStatus.UNPROCESSABLE_ENTITY)
            })
        })

        describe('when the movie-draft or image does not exist', () => {
            it('returns 404 Not Found', async () => {
                const movieDraft = await createMovieDraft(fix)

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${nullObjectId}/complete`)
                    .notFound({ ...Errors.MovieDrafts.ImageNotFound, imageId: nullObjectId })

                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/images/${nullObjectId}/complete`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:id (with images)', () => {
        describe('when the movie-draft exists with images', () => {
            let movieDraft: MovieDraftDto
            let downloadUrl: string

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
                const upload = await uploadDraftImage(fix, movieDraft.id)

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${upload.imageId}/complete`)
                    .ok()

                const [asset] = await fix.assetsClient.getMany([upload.imageId])

                if (!asset.download) {
                    throw new Error('download URL missing')
                }

                downloadUrl = asset.download.url
            })

            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()
            })

            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: movieDraft.id })
            })

            it('invalidates image URL', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()

                const response = await fetch(downloadUrl)
                expect(response.status).toBe(404)
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${nullObjectId}`).noContent()
            })
        })
    })

    describe('DELETE /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movie: MovieDraftDto

            beforeEach(async () => {
                movie = await createMovieDraft(fix)
            })

            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movie.id}`).noContent()
            })

            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movie.id}`).noContent()

                await fix.httpClient
                    .get(`/movie-drafts/${movie.id}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: movie.id })
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${nullObjectId}`).noContent()
            })
        })
    })

    describe('POST /movie-drafts/:id/complete', () => {
        describe('when the movie-draft exists and is valid', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('creates a Movie, removes the movie-draft, and returns the created Movie', async () => {
                const upload = await uploadDraftImage(fix, movieDraft.id)

                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${upload.imageId}/complete`)
                    .ok()

                const { assetIds: _ignored, ...updateDto } = buildCreateMovieDto({
                    title: 'draft title',
                    plot: 'draft plot'
                })

                await fix.httpClient.patch(`/movie-drafts/${movieDraft.id}`).body(updateDto).ok()

                const { body: createdMovie } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/complete`)
                    .created()

                expect(createdMovie).toEqual(
                    expect.objectContaining({
                        id: expect.any(String),
                        ...updateDto,
                        imageUrls: expect.any(Array)
                    })
                )

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: movieDraft.id })

                const { body: fetchedMovie } = await fix.httpClient
                    .get(`/movies/${createdMovie.id}`)
                    .ok()

                expect(fetchedMovie).toEqual(
                    expect.objectContaining({
                        id: createdMovie.id,
                        ...updateDto,
                        imageUrls: expect.any(Array)
                    })
                )

                expect(createdMovie.imageUrls).toHaveLength(1)

                const response = await fetch(createdMovie.imageUrls[0])
                expect(response.ok).toBe(true)

                const buffer = Buffer.from(await response.arrayBuffer())
                expect(Checksum.fromBuffer(buffer)).toEqual(imageFile.checksum)
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/complete`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })
})
