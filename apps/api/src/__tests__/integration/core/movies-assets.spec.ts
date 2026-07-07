import type { MovieDto } from 'core'
import type { AssetPresignedUploadDto, AssetsService } from 'infrastructure'
import { ensure, Require } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import {
    buildCreateAssetDto,
    createMovieAsset,
    createUnpublishedMovie,
    Errors,
    testAssets,
    uploadAndFinalizeMovieAsset,
    uploadAsset,
    type AppTestContext
} from '../helpers'

describe('MoviesAssets', () => {
    let fix: AppTestContext
    let assetsService: AssetsService

    beforeEach(async () => {
        const { createAppTestContext } = await import('../helpers')
        const { AssetsService } = await import('infrastructure')
        const { AdminAuthGuard } = await import('gateway')
        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        assetsService = fix.module.get(AssetsService)
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/assets', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
        })

        it('업로드 URL이 포함된 에셋 업로드 정보를 반환한다', async () => {
            const createDto = buildCreateAssetDto(testAssets.image)

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

        it('반환된 업로드 URL로 에셋을 업로드할 수 있다', async () => {
            const createDto = buildCreateAssetDto(testAssets.image)

            const { body: upload } = await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .body(createDto)
                .created()

            const response = await uploadAsset(testAssets.image.path, upload)

            expect(response.ok).toBe(true)
        })

        it('지원하지 않는 MIME 타입이면 400을 반환한다', async () => {
            const createDto = buildCreateAssetDto(testAssets.json)

            await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .body(createDto)
                .badRequest(Errors.Movies.UnsupportedAssetType(createDto.mimeType))
        })

        it('영화가 없으면 404를 반환한다', async () => {
            const createDto = buildCreateAssetDto(testAssets.image)

            await fix.httpClient
                .post(`/movies/${nullObjectId}/assets`)
                .body(createDto)
                .notFound(Errors.Movies.NotFound(nullObjectId))
        })
    })

    describe('DELETE /movies/:movieId/assets/:assetId', () => {
        describe('업로드가 완료된 에셋을 삭제할 때', () => {
            let movie: MovieDto
            let assetId: string

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                assetId = await uploadAndFinalizeMovieAsset(fix, movie.id)
            })

            it('204를 반환한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()
            })

            it('에셋 URL이 무효화된다', async () => {
                const asset = ensure((await assetsService.getMany([assetId]))[0])
                Require.defined(asset.download)

                await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()

                const response = await fetch(asset.download.url)
                expect(response.status).toBe(404)
            })
        })

        it('에셋이 없어도 204를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)

            await fix.httpClient.delete(`/movies/${movie.id}/assets/${nullObjectId}`).noContent()
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
                .notFound(Errors.Movies.NotFound(nullObjectId))
        })
    })

    describe('POST /movies/:movieId/assets/:assetId/finalize', () => {
        describe('업로드까지 마친 에셋을 완료 처리할 때', () => {
            let movie: MovieDto
            let upload: AssetPresignedUploadDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                upload = await createMovieAsset(fix, movie.id, testAssets.image)

                const uploadResponse = await uploadAsset(testAssets.image.path, upload)
                expect(uploadResponse.ok).toBe(true)
            })

            it('204를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .noContent()
            })

            // 공개 GET은 draft를 404로 숨기므로, draft 상태의 결과 확인은 서비스로 조회한다.
            const getImageUrls = async () => {
                const { MoviesService } = await import('core')
                const moviesService = fix.module.get(MoviesService)
                const [found] = await moviesService.getMany([movie.id])
                return found?.imageUrls
            }

            it('영화의 imageUrls에 에셋이 추가된다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .noContent()

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })

            it('두 번 호출해도 에셋은 한 번만 추가된다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .noContent()

                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .noContent()

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })

            it('동시에 여러 번 호출해도 에셋은 한 번만 추가된다', async () => {
                // 여러 요청이 모두 includes 검사를 통과한 뒤 addAsset에 도달하는 경쟁을 재현한다.
                // 직렬화 시점에 따라 일부가 404(AssetNotFound)일 수 있어 상태는 단정하지 않고 끝 상태만 본다.
                const finalize = () =>
                    fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .sendRaw()

                await Promise.all(Array.from({ length: 8 }, finalize))

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })
        })

        it('업로드 전 에셋을 완료 처리하면 422를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)
            const upload = await createMovieAsset(fix, movie.id, testAssets.image)

            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .unprocessableEntity(Errors.Movies.AssetUploadInvalid(upload.assetId))
        })

        it('에셋이 없으면 404를 반환한다', async () => {
            const movie = await createUnpublishedMovie(fix)

            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${nullObjectId}/finalize`)
                .notFound(Errors.Movies.AssetNotFound(nullObjectId))
        })

        it('영화가 없으면 404를 반환한다', async () => {
            await fix.httpClient
                .post(`/movies/${nullObjectId}/assets/${nullObjectId}/finalize`)
                .notFound(Errors.Movies.NotFound(nullObjectId))
        })
    })
})
