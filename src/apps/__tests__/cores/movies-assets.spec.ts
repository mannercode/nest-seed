import { Expect } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateAssetDto, Errors, fixtureFiles, uploadAsset } from '../__helpers__'
import { createMovie, createMovieAsset, uploadCompleteMovieAsset } from './movies-assets.fixture'
import type { MoviesAssetsFixture } from './movies-assets.fixture'
import type { MovieDto } from 'apps/cores'
import type { AssetPresignedUploadDto } from 'apps/infrastructures'

describe('MoviesAssets', () => {
    let fix: MoviesAssetsFixture

    beforeEach(async () => {
        const { createMoviesAssetsFixture } = await import('./movies-assets.fixture')
        fix = await createMoviesAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/assets', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 업로드 URL이 포함된 에셋 슬롯을 반환한다
            it('returns a created asset slot with an upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
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
                    .post(`/movies/${movie.id}/assets`)
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
                        .post(`/movies/${movie.id}/assets`)
                        .body(createDto)
                        .badRequest({
                            ...Errors.Movies.UnsupportedAssetType,
                            mimeType: createDto.mimeType
                        })
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                await fix.httpClient
                    .post(`/movies/${nullObjectId}/assets`)
                    .body(createDto)
                    .notFound({ ...Errors.Movies.NotFound, notFoundMovieId: nullObjectId })
            })
        })
    })

    describe('DELETE /movies/:movieId/assets/:assetId', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 업로드가 완료된 때
            describe('when upload is completed', () => {
                let assetId: string

                beforeEach(async () => {
                    assetId = await uploadCompleteMovieAsset(fix, movie.id)
                })

                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()
                })

                // 에셋 URL을 무효화한다
                it('invalidates asset URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([assetId])
                    Expect.defined(asset.download)

                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })

            // 에셋이 존재하지 않을 때
            describe('when the asset does not exist', () => {
                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient
                        .delete(`/movies/${movie.id}/assets/${nullObjectId}`)
                        .noContent()
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
                    .notFound({ ...Errors.Movies.NotFound, notFoundMovieId: nullObjectId })
            })
        })
    })

    describe('POST /movies/:movieId/assets/:assetId/complete', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 에셋이 존재할 때
            describe('when the asset exists', () => {
                let upload: AssetPresignedUploadDto

                beforeEach(async () => {
                    upload = await createMovieAsset(fix, movie.id, fix.asset)
                })

                // 업로드가 성공한 때
                describe('when upload succeeded', () => {
                    beforeEach(async () => {
                        const res = await uploadAsset(fix.asset.path, upload)
                        expect(res.ok).toBe(true)
                    })

                    // 200 OK를 반환한다
                    it('returns 200 OK', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                            .ok({})
                    })

                    // 영화에 에셋을 포함한다
                    it('includes the asset in the movie', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                            .ok()

                        await fix.httpClient
                            .get(`/movies/${movie.id}`)
                            .ok(expect.objectContaining({ imageUrls: [expect.any(String)] }))
                    })

                    // 이미 완료된 때
                    it('returns 200 OK when already completed', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                            .ok({})

                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                            .ok({})
                    })
                })

                // 업로드가 누락된 때
                describe('when the upload is missing', () => {
                    // 422 Unprocessable Entity를 반환한다
                    it('returns 422 Unprocessable Entity', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                            .unprocessableEntity({
                                ...Errors.Movies.AssetUploadInvalid,
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
                        .post(`/movies/${movie.id}/assets/${nullObjectId}/complete`)
                        .notFound({ ...Errors.Movies.AssetNotFound, notFoundAssetId: nullObjectId })
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/assets/${nullObjectId}/complete`)
                    .notFound({ ...Errors.Movies.NotFound, notFoundMovieId: nullObjectId })
            })
        })
    })
})
