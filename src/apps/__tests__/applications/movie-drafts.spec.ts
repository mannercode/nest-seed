import { MovieGenre, MovieRating } from 'apps/cores'
import { Expect } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateAssetDto, Errors, fixtureFiles, uploadAsset } from '../__helpers__'
import {
    createMovieDraft,
    createMovieImageDraft,
    uploadCompleteDraftImage
} from './movie-drafts.fixture'
import type { MovieDraftsFixture } from './movie-drafts.fixture'
import type { MovieDraftDto } from 'apps/applications'
import type { AssetPresignedUploadDto } from 'apps/infrastructures'

describe('MovieDraftsService', () => {
    let fix: MovieDraftsFixture

    beforeEach(async () => {
        const { createMovieDraftsFixture } = await import('./movie-drafts.fixture')
        fix = await createMovieDraftsFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movie-drafts', () => {
        // 생성된 영화 초안을 반환한다
        it('returns the created movie-draft', async () => {
            await fix.httpClient
                .post('/movie-drafts')
                .created(expect.objectContaining({ id: expect.any(String) }))
        })
    })

    describe('GET /movie-drafts/:id', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 영화 초안을 반환한다
            it('returns the movie-draft', async () => {
                await fix.httpClient.get(`/movie-drafts/${movieDraft.id}`).ok(movieDraft)
            })
        })

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/movie-drafts/${nullObjectId}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('PATCH /movie-drafts/:id', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 수정된 영화 초안을 반환한다
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

            // 수정 내용이 저장된다
            it('persists the update', async () => {
                const updateDto = { title: 'update title' }
                await fix.httpClient.patch(`/movie-drafts/${movieDraft.id}`).body(updateDto).ok()

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .ok({ ...movieDraft, ...updateDto })
            })
        })

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/movie-drafts/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('POST /movie-drafts/:id/images', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 업로드 URL이 포함된 이미지 슬롯을 반환한다
            it('returns a created image slot with an upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.image)

                const { body } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .created()

                expect(body).toEqual(
                    expect.objectContaining({
                        // imageId: expect.any(String),
                        assetId: expect.any(String),
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'POST',
                        fields: expect.objectContaining({ 'Content-Type': createDto.mimeType })
                    })
                )
            })

            // 업로드 URL로 이미지를 업로드한다
            it('uploads the image via the upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.image)

                const { body: upload } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images`)
                    .body(createDto)
                    .created()

                const response = await uploadAsset(fix.image.path, upload)

                expect(response.ok).toBe(true)
            })

            // 이미지 타입이 지원되지 않을 때
            describe('when the image type is not supported', () => {
                const createDto = buildCreateAssetDto(fixtureFiles.json)

                // 400 Bad Request를 반환한다
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

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const createDto = buildCreateAssetDto(fix.image)

                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/images`)
                    .body(createDto)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:draftId/images/:imageId', () => {
        // 이미지 초안이 존재할 때
        describe('when the image-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 업로드가 완료된 경우
            describe('when upload is completed', () => {
                let imageId: string

                beforeEach(async () => {
                    imageId = await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/images/${imageId}`)
                        .noContent()
                })

                // 이미지 URL을 무효화한다
                it('invalidates image URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([imageId])
                    Expect.defined(asset.download)

                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/images/${imageId}`)
                        .noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })

                // 이미지 초안이 존재하지 않을 때
                describe('when the image-draft does not exist', () => {
                    // 204 No Content를 반환한다
                    it('returns 204 No Content', async () => {
                        await fix.httpClient
                            .delete(`/movie-drafts/${movieDraft.id}/images/${nullObjectId}`)
                            .noContent()
                    })
                })
            })
        })

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient
                    .delete(`/movie-drafts/${nullObjectId}/images/${nullObjectId}`)
                    .noContent()
            })
        })
    })

    describe('POST /movie-drafts/:draftId/images/:imageId/complete', () => {
        let movieDraft: MovieDraftDto

        beforeEach(async () => {
            movieDraft = await createMovieDraft(fix)
        })

        // 이미지 초안이 존재할 때
        describe('when the image-draft exists', () => {
            let upload: AssetPresignedUploadDto

            beforeEach(async () => {
                upload = await createMovieImageDraft(fix, movieDraft.id, fix.image)
            })

            // 업로드가 성공한 경우
            describe('when upload succeeded', () => {
                beforeEach(async () => {
                    const res = await uploadAsset(fix.image.path, upload)
                    expect(res.ok).toBe(true)
                })

                // 상태 ready를 반환한다
                it('returns status: ready', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images/${upload.assetId}/complete`)
                        .ok({ id: upload.assetId, status: 'ready' })
                })

                // 영화 초안에 이미지를 포함한다
                it('includes the image in the movie-draft', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images/${upload.assetId}/complete`)
                        .ok()

                    await fix.httpClient
                        .get(`/movie-drafts/${movieDraft.id}`)
                        .ok(expect.objectContaining({ assetIds: [upload.assetId] }))
                })
            })

            // 업로드가 누락된 경우
            describe('when the upload is missing', () => {
                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/images/${upload.assetId}/complete`)
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.ImageUploadInvalid,
                            assetId: upload.assetId
                        })
                })
            })
        })

        // 이미지가 존재하지 않을 때
        describe('when the image does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/images/${nullObjectId}/complete`)
                    .notFound({ ...Errors.MovieDrafts.ImageNotFound, imageId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:id', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: movieDraft.id })
            })

            // 이미지가 있는 경우
            describe('when it has images', () => {
                let imageId: string

                beforeEach(async () => {
                    imageId = await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                // 이미지 URL을 무효화한다
                it('invalidates image URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([imageId])
                    Expect.defined(asset.download)

                    await fix.httpClient.delete(`/movie-drafts/${movieDraft.id}`).noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })
        })

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                await fix.httpClient.delete(`/movie-drafts/${nullObjectId}`).noContent()
            })
        })
    })

    describe('POST /movie-drafts/:id/complete', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 유효한 상태인 경우
            describe('when it is valid', () => {
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

                // 생성된 영화를 반환한다
                it('returns the created movie', async () => {
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

                // 영화를 생성한다
                it('creates a movie', async () => {
                    const { body: movie } = await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .created()

                    await fix.httpClient
                        .get(`/movies/${movie.id}`)
                        .ok({ ...movie, imageUrls: expect.any(Array) })
                })

                // 영화 초안을 삭제한다
                it('removes the movie-draft', async () => {
                    await fix.httpClient.post(`/movie-drafts/${movieDraft.id}/complete`).created()

                    await fix.httpClient
                        .get(`/movie-drafts/${movieDraft.id}`)
                        .notFound({
                            ...Errors.Mongoose.DocumentNotFound,
                            notFoundId: movieDraft.id
                        })
                })
            })

            // 이미지가 누락된 경우
            describe('when images are missing', () => {
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

                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/complete`)
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
            })

            // 유효하지 않은 상태인 경우
            describe('when it is invalid', () => {
                beforeEach(async () => {
                    await uploadCompleteDraftImage(fix, movieDraft.id)
                })

                // 422 Unprocessable Entity를 반환한다
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

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/complete`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })
})
