import { MovieGenre, MovieRating } from 'apps/cores'
import { Assert } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateAssetDto, Errors, fixtureFiles, uploadAsset } from '../__helpers__'
import {
    createMovieDraft,
    createMovieImageDraft,
    uploadCompleteDraftImage
} from './movie-drafts.fixture'
import type { MovieDraftsFixture } from './movie-drafts.fixture'
import type { DraftImageUploadResponse, MovieDraftDto } from 'apps/applications'

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
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('returns created image slot with an upload URL', async () => {
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

            // TODO fix desc
            it('uploads an S3 upload URL', async () => {
                const createDto = buildCreateAssetDto(imageFile)

                const { body } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .created()

                const response = await uploadAsset(imageFile.path, body.upload)

                expect(response.ok).toBe(true)
            })

            describe('when the image type is not supported', () => {
                const createDto = buildCreateAssetDto(fixtureFiles.json)

                it('returns 400 Bad Request', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images`)
                        .body(createDto)
                        .badRequest({
                            ...Errors.MovieDrafts.UnsupportedImageType,
                            mimeType: createDto.mimeType
                        })
                })
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
    })

    describe('DELETE /movie-drafts/:draftId/images/:imageId', () => {
        let movieDraft: MovieDraftDto

        beforeEach(async () => {
            movieDraft = await createMovieDraft(fix)
        })

        describe('when the image-draft exists', () => {
            describe('when upload completed', () => {
                let imageId: string

                beforeEach(async () => {
                    imageId = await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                it('returns 204 No Content', async () => {
                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/images/${imageId}`)
                        .noContent()
                })

                it('invalidates image URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([imageId])
                    Assert.defined(asset.download)

                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/images/${imageId}`)
                        .noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 204 No Content', async () => {
                await fix.httpClient
                    .delete(`/movie-drafts/${nullObjectId}/images/${nullObjectId}`)
                    .noContent()
            })
        })

        describe('when the image-draft does not exist', () => {
            it('returns 204 No Content', async () => {
                await fix.httpClient
                    .delete(`/movie-drafts/${movieDraft.id}/images/${nullObjectId}`)
                    .noContent()
            })
        })
    })

    describe('POST /movie-drafts/:draftId/images/:imageId/complete', () => {
        let movieDraft: MovieDraftDto

        beforeEach(async () => {
            movieDraft = await createMovieDraft(fix)
        })

        describe('when the image-draft exists', () => {
            let imageDraft: DraftImageUploadResponse

            beforeEach(async () => {
                imageDraft = await createMovieImageDraft(fix, movieDraft.id, imageFile)
            })

            describe('when upload succeeded', () => {
                beforeEach(async () => {
                    const res = await uploadAsset(imageFile.path, imageDraft.upload)
                    expect(res.ok).toBe(true)
                })

                it('returns status:ready', async () => {
                    await fix.httpClient
                        .post(
                            `/movie-drafts/${movieDraft.id}/images/${imageDraft.imageId}/complete`
                        )
                        .ok({ id: imageDraft.imageId, status: 'ready' })
                })

                it('movie-draft에 이미지를 포함한다', async () => {
                    await fix.httpClient
                        .post(
                            `/movie-drafts/${movieDraft.id}/images/${imageDraft.imageId}/complete`
                        )
                        .ok()

                    await fix.httpClient
                        .get(`/movie-drafts/${movieDraft.id}`)
                        .ok(expect.objectContaining({ assetIds: [imageDraft.imageId] }))
                })
            })

            describe('when the upload missing', () => {
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(
                            `/movie-drafts/${movieDraft.id}/images/${imageDraft.imageId}/complete`
                        )
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.ImageUploadInvalid,
                            imageId: imageDraft.imageId
                        })
                })
            })
        })

        describe('when the image does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${nullObjectId}/complete`)
                    .notFound({ ...Errors.MovieDrafts.ImageNotFound, imageId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
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

            describe('when has images', () => {
                let imageId: string

                beforeEach(async () => {
                    imageId = await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                it('invalidates image URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([imageId])
                    Assert.defined(asset.download)

                    await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${nullObjectId}`).noContent()
            })
        })
    })

    describe('POST /movie-drafts/:id/complete', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            describe('when is valid', () => {
                const updateDto = {
                    title: `MovieTitle`,
                    genres: [MovieGenre.Action],
                    releaseDate: new Date(0),
                    plot: `MoviePlot`,
                    durationInSeconds: 90 * 60,
                    director: 'Quentin Tarantino',
                    rating: MovieRating.PG
                }

                beforeEach(async () => {
                    await uploadCompleteDraftImage(fix, movieDraft.id)
                    await fix.httpClient
                        .patch(`/movie-drafts/${movieDraft.id}`)
                        .body(updateDto)
                        .ok()
                })

                it('returns the created Movie', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .created(
                            expect.objectContaining({
                                id: expect.any(String),
                                ...updateDto,
                                imageUrls: expect.any(Array)
                            })
                        )
                })

                it('creates a Movie ', async () => {
                    const { body: movie } = await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .created()

                    await fix.httpClient
                        .get(`/movies/${movie.id}`)
                        .ok({ ...movie, imageUrls: expect.any(Array) })
                })

                it(' removes the movie-draft', async () => {
                    await fix.httpClient.post(`/movie-drafts/${movieDraft.id}/complete`).created()

                    await fix.httpClient
                        .get(`/movie-drafts/${movieDraft.id}`)
                        .notFound({
                            ...Errors.Mongoose.DocumentNotFound,
                            notFoundId: movieDraft.id
                        })
                })
            })

            describe('when missing images', () => {
                beforeEach(async () => {
                    await fix.httpClient
                        .patch(`/movie-drafts/${movieDraft.id}`)
                        .body({
                            title: `MovieTitle`,
                            genres: [MovieGenre.Action],
                            releaseDate: new Date(0),
                            plot: `MoviePlot`,
                            durationInSeconds: 90 * 60,
                            director: 'Quentin Tarantino',
                            rating: MovieRating.PG
                        })
                        .ok()
                })

                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
            })

            describe('when is invalid', () => {
                beforeEach(async () => {
                    await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
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
