import { MovieGenre, MovieRating } from 'apps/cores'
import { Expect } from 'common'
import { nullObjectId, oid } from 'testlib'
import { buildCreateAssetDto, Errors, fixtureFiles, uploadAsset } from '../__helpers__'
import {
    createMovieAsset,
    createMovieDraft,
    uploadCompleteDraftAsset
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

    describe('GET /movie-drafts/:draftId', () => {
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

    describe('PATCH /movie-drafts/:draftId', () => {
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

    describe('POST /movie-drafts/:draftId/assets', () => {
        // 영화 초안이 존재할 때
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 업로드 URL이 포함된 에셋 슬롯을 반환한다
            it('returns a created asset slot with an upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/assets`)
                    .body(createDto)
                    .created()

                expect(body).toEqual(
                    expect.objectContaining({
                        assetId: expect.any(String),
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'POST',
                        fields: expect.objectContaining({ 'Content-Type': createDto.mimeType })
                    })
                )
            })

            // 업로드 URL로 에셋을 업로드한다
            it('uploads the asset via the upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body: upload } = await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/assets`)
                    .body(createDto)
                    .created()

                const response = await uploadAsset(fix.asset.path, upload)

                expect(response.ok).toBe(true)
            })

            // 에셋 타입이 지원되지 않을 때
            describe('when the asset type is not supported', () => {
                const createDto = buildCreateAssetDto(fixtureFiles.json)

                // 400 Bad Request를 반환한다
                it('returns 400 Bad Request', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/assets`)
                        .body(createDto)
                        .badRequest({
                            ...Errors.MovieDrafts.UnsupportedAssetType,
                            mimeType: createDto.mimeType
                        })
                })
            })
        })

        // 영화 초안이 존재하지 않을 때
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                await fix.httpClient
                    .post(`/movie-drafts/${nullObjectId}/assets`)
                    .body(createDto)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:draftId/assets/:assetId', () => {
        // 에셋이 존재할 때
        describe('when the asset exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            // 업로드가 완료된 경우
            describe('when upload is completed', () => {
                let assetId: string

                beforeEach(async () => {
                    assetId = await uploadCompleteDraftAsset(fix, movieDraft.id)
                })

                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/assets/${assetId}`)
                        .noContent()
                })

                // 에셋 URL을 무효화한다
                it('invalidates asset URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([assetId])
                    Expect.defined(asset.download)

                    await fix.httpClient
                        .delete(`/movie-drafts/${movieDraft.id}/assets/${assetId}`)
                        .noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })

                // 에셋이 존재하지 않을 때
                describe('when the asset does not exist', () => {
                    // 204 No Content를 반환한다
                    it('returns 204 No Content', async () => {
                        await fix.httpClient
                            .delete(`/movie-drafts/${movieDraft.id}/assets/${nullObjectId}`)
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
                    .delete(`/movie-drafts/${nullObjectId}/assets/${nullObjectId}`)
                    .noContent()
            })
        })
    })

    describe('POST /movie-drafts/:draftId/assets/:assetId/complete', () => {
        let movieDraft: MovieDraftDto

        beforeEach(async () => {
            movieDraft = await createMovieDraft(fix)
        })

        // 에셋이 존재할 때
        describe('when the asset exists', () => {
            let upload: AssetPresignedUploadDto

            beforeEach(async () => {
                upload = await createMovieAsset(fix, movieDraft.id, fix.asset)
            })

            // 업로드가 성공한 경우
            describe('when upload succeeded', () => {
                beforeEach(async () => {
                    const res = await uploadAsset(fix.asset.path, upload)
                    expect(res.ok).toBe(true)
                })

                // 상태 ready를 반환한다
                it('returns status: ready', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/assets/${upload.assetId}/complete`)
                        .ok({ id: upload.assetId, status: 'ready' })
                })

                // 영화 초안에 에셋을 포함한다
                it('includes the asset in the movie-draft', async () => {
                    await fix.httpClient
                        .post(`/movie-drafts/${movieDraft.id}/assets/${upload.assetId}/complete`)
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
                        .post(`/movie-drafts/${movieDraft.id}/assets/${upload.assetId}/complete`)
                        .unprocessableEntity({
                            ...Errors.MovieDrafts.AssetUploadInvalid,
                            assetId: upload.assetId
                        })
                })
            })
        })

        // 에셋이 존재하지 않을 때
        describe('when the asset does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-drafts/${movieDraft.id}/assets/${nullObjectId}/complete`)
                    .notFound({ ...Errors.MovieDrafts.AssetNotFound, assetId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:draftId', () => {
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

            // 에셋이 있는 경우
            describe('when it has assets', () => {
                let assetId: string

                beforeEach(async () => {
                    assetId = await uploadCompleteDraftAsset(fix, movieDraft.id)
                })

                // 에셋 URL을 무효화한다
                it('invalidates asset URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([assetId])
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

    describe('POST /movie-drafts/:draftId/complete', () => {
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
                    await uploadCompleteDraftAsset(fix, movieDraft.id)
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

            // 에셋이 누락된 경우
            describe('when assets are missing', () => {
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

            // 에셋이 업로드되지 않은 경우
            describe('when assets are pending', () => {
                beforeEach(async () => {
                    await createMovieAsset(fix, movieDraft.id, fix.asset)
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
                            missingFields: expect.arrayContaining(['assetIds'])
                        })
                })
            })

            // 유효하지 않은 상태인 경우
            describe('when it is invalid', () => {
                beforeEach(async () => {
                    await uploadCompleteDraftAsset(fix, movieDraft.id)
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

    describe('when repository operations fail', () => {
        // 초안 삭제가 실패할 때
        describe('when deleting the draft fails', () => {
            // 생성된 영화를 삭제한다
            it('deletes the created movie', async () => {
                const { MovieDraftsService, MovieDraftsRepository } =
                    await import('apps/applications')
                const { MovieDraftAssetStatus } =
                    await import('apps/applications/services/movie-drafts/models/movie-draft-asset')
                const { MoviesClient } = await import('apps/cores')

                const movieDraftsService = fix.module.get(MovieDraftsService)
                const movieDraftsRepository = fix.module.get(MovieDraftsRepository)
                const moviesClient = fix.module.get(MoviesClient)

                const draftId = oid(0x31)
                const assetId = oid(0x32)

                const draft = {
                    id: draftId,
                    title: 'draft-title',
                    genres: [MovieGenre.Action],
                    releaseDate: new Date(),
                    plot: 'draft-plot',
                    durationInSeconds: 60,
                    director: 'draft-director',
                    rating: MovieRating.PG,
                    assets: [{ assetId, status: MovieDraftAssetStatus.Ready }],
                    deleteOne: jest.fn().mockRejectedValue(new Error('delete failed'))
                }

                jest.spyOn(movieDraftsRepository, 'getById').mockResolvedValueOnce(draft as any)

                jest.spyOn(moviesClient, 'create').mockResolvedValue({ id: 'movie-id' } as any)
                const deleteSpy = jest.spyOn(moviesClient, 'deleteMany').mockResolvedValue({})

                await expect(movieDraftsService.completeMovieDraft(draftId)).rejects.toThrow(
                    'delete failed'
                )

                expect(deleteSpy).toHaveBeenCalledWith(['movie-id'])
            })
        })

        // 에셋 추가가 실패할 때
        describe('when adding an asset fails', () => {
            // 생성된 에셋을 삭제한다
            it('deletes the created asset', async () => {
                const { MovieDraftsService, MovieDraftsRepository } =
                    await import('apps/applications')
                const { AssetsClient } = await import('apps/infrastructures')

                const movieDraftsService = fix.module.get(MovieDraftsService)
                const movieDraftsRepository = fix.module.get(MovieDraftsRepository)
                const assetsClient = fix.module.get(AssetsClient)

                const draft = await movieDraftsService.createMovieDraft()
                const assetId = oid(0x33)

                jest.spyOn(assetsClient, 'create').mockResolvedValue({
                    assetId,
                    url: 'https://example.com',
                    expiresAt: new Date(),
                    method: 'POST',
                    fields: {}
                })

                const deleteSpy = jest.spyOn(assetsClient, 'deleteMany').mockResolvedValue({})
                jest.spyOn(movieDraftsRepository, 'addOrUpdateAsset').mockRejectedValueOnce(
                    new Error('repo error')
                )

                const createDto = buildCreateAssetDto(fix.asset)

                await expect(movieDraftsService.createAsset(draft.id, createDto)).rejects.toThrow(
                    'repo error'
                )

                expect(deleteSpy).toHaveBeenCalledWith([assetId])
            })
        })

        // 에셋 삭제가 실패할 때
        describe('when deleting an asset fails', () => {
            // 에셋 정보를 복원한다
            it('restores the draft asset', async () => {
                const { MovieDraftsService, MovieDraftsRepository } =
                    await import('apps/applications')
                const { MovieDraftAssetStatus } =
                    await import('apps/applications/services/movie-drafts/models/movie-draft-asset')
                const { AssetsClient } = await import('apps/infrastructures')

                const movieDraftsService = fix.module.get(MovieDraftsService)
                const movieDraftsRepository = fix.module.get(MovieDraftsRepository)
                const assetsClient = fix.module.get(AssetsClient)

                const draft = await movieDraftsService.createMovieDraft()
                const assetId = oid(0x34)

                await movieDraftsRepository.addOrUpdateAsset(draft.id, {
                    assetId,
                    status: MovieDraftAssetStatus.Ready
                })

                jest.spyOn(assetsClient, 'deleteMany').mockRejectedValueOnce(
                    new Error('delete failed')
                )

                await expect(movieDraftsService.deleteAsset(draft.id, assetId)).rejects.toThrow(
                    'delete failed'
                )

                const updatedDraft = await movieDraftsRepository.getById(draft.id)
                const hasAsset = updatedDraft.assets.some((asset) => asset.assetId === assetId)
                expect(hasAsset).toBe(true)
            })
        })

        // 에셋 완료 업데이트가 실패할 때
        describe('when completing an asset fails', () => {
            // 에셋을 삭제한다
            it('deletes the asset', async () => {
                const { MovieDraftsService, MovieDraftsRepository } =
                    await import('apps/applications')
                const { MovieDraftAssetStatus } =
                    await import('apps/applications/services/movie-drafts/models/movie-draft-asset')
                const { AssetsClient } = await import('apps/infrastructures')

                const movieDraftsService = fix.module.get(MovieDraftsService)
                const movieDraftsRepository = fix.module.get(MovieDraftsRepository)
                const assetsClient = fix.module.get(AssetsClient)

                const draft = await movieDraftsService.createMovieDraft()
                const assetId = oid(0x35)

                await movieDraftsRepository.addOrUpdateAsset(draft.id, {
                    assetId,
                    status: MovieDraftAssetStatus.Pending
                })

                jest.spyOn(assetsClient, 'isUploadComplete').mockResolvedValueOnce(true)
                jest.spyOn(assetsClient, 'complete').mockResolvedValue({ id: assetId } as any)

                const deleteSpy = jest.spyOn(assetsClient, 'deleteMany').mockResolvedValue({})
                jest.spyOn(movieDraftsRepository, 'addOrUpdateAsset').mockRejectedValueOnce(
                    new Error('repo error')
                )

                await expect(movieDraftsService.completeAsset(draft.id, assetId)).rejects.toThrow(
                    'repo error'
                )

                expect(deleteSpy).toHaveBeenCalledWith([assetId])
            })
        })
    })
})
