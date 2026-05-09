import type { MovieDto } from 'core'
import type { AssetPresignedUploadDto } from 'infrastructure'
import { Require } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { buildCreateAssetDto, Errors, testAssets, uploadAsset } from '../../helpers'
import {
    createMovieAsset,
    createUnpublishedMovie,
    uploadAndFinalizeMovieAsset,
    type MoviesAssetsFixture
} from './movies-assets.fixture'

describe('MoviesAssets', () => {
    let fix: MoviesAssetsFixture

    beforeEach(async () => {
        const { createMoviesAssetsFixture } = await import('./movies-assets.fixture')
        fix = await createMoviesAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/assets', () => {
        describe('영화가 존재할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })

            it('업로드 URL이 포함된 에셋 업로드 정보를 반환한다', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .body(createDto)
                    .created()

                expect(body).toEqual(
                    expect.objectContaining({
                        assetId: expect.any(String),
                        expiresAt: expect.any(Date),
                        fields: expect.objectContaining({ 'Content-Type': createDto.mimeType }),
                        method: 'POST',
                        url: expect.any(String)
                    })
                )
            })

            it('업로드 URL로 에셋을 업로드한다', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body: upload } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .body(createDto)
                    .created()

                const response = await uploadAsset(fix.asset.path, upload)

                expect(response.ok).toBe(true)
            })

            describe('에셋 타입이 지원되지 않을 때', () => {
                const createDto = buildCreateAssetDto(testAssets.json)

                it('400 Bad Request를 반환한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets`)
                        .body(createDto)
                        .badRequest(Errors.Movies.UnsupportedAssetType(createDto.mimeType))
                })
            })
        })

        describe('영화가 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                await fix.httpClient
                    .post(`/movies/${nullObjectId}/assets`)
                    .body(createDto)
                    .notFound(Errors.Movies.NotFound(nullObjectId))
            })
        })
    })

    describe('DELETE /movies/:movieId/assets/:assetId', () => {
        describe('영화가 존재할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })

            describe('업로드가 완료되었을 때', () => {
                let assetId: string

                beforeEach(async () => {
                    assetId = await uploadAndFinalizeMovieAsset(fix, movie.id)
                })

                it('204 No Content를 반환한다', async () => {
                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()
                })

                it('에셋 URL을 무효화한다', async () => {
                    const [asset] = await fix.assetsService.getMany([assetId])
                    Require.defined(asset.download)

                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })

            describe('에셋이 존재하지 않을 때', () => {
                it('204 No Content를 반환한다', async () => {
                    await fix.httpClient
                        .delete(`/movies/${movie.id}/assets/${nullObjectId}`)
                        .noContent()
                })
            })
        })

        describe('영화가 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
                    .notFound(Errors.Movies.NotFound(nullObjectId))
            })
        })
    })

    describe('POST /movies/:movieId/assets/:assetId/finalize', () => {
        describe('영화가 존재할 때', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })

            describe('에셋이 존재할 때', () => {
                let upload: AssetPresignedUploadDto

                beforeEach(async () => {
                    upload = await createMovieAsset(fix, movie.id, fix.asset)
                })

                describe('업로드가 성공했을 때', () => {
                    beforeEach(async () => {
                        const uploadResponse = await uploadAsset(fix.asset.path, upload)
                        expect(uploadResponse.ok).toBe(true)
                    })

                    it('204 No Content를 반환한다', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                            .noContent()
                    })

                    it('영화에 에셋을 포함한다', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                            .noContent()

                        await fix.httpClient
                            .get(`/movies/${movie.id}`)
                            .ok(expect.objectContaining({ imageUrls: [expect.any(String)] }))
                    })

                    describe('이미 완료되었을 때', () => {
                        beforeEach(async () => {
                            await fix.httpClient
                                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                                .noContent()
                        })

                        it('204 No Content를 반환한다', async () => {
                            await fix.httpClient
                                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                                .noContent()
                        })
                    })
                })

                describe('업로드가 완료되지 않았을 때', () => {
                    it('422 Unprocessable Entity를 반환한다', async () => {
                        await fix.httpClient
                            .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                            .unprocessableEntity(Errors.Movies.AssetUploadInvalid(upload.assetId))
                    })
                })
            })

            describe('에셋이 존재하지 않을 때', () => {
                it('404 Not Found를 반환한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${nullObjectId}/finalize`)
                        .notFound(Errors.Movies.AssetNotFound(nullObjectId))
                })
            })
        })

        describe('영화가 존재하지 않을 때', () => {
            it('404 Not Found를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/assets/${nullObjectId}/finalize`)
                    .notFound(Errors.Movies.NotFound(nullObjectId))
            })
        })
    })
})
