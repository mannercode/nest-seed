import { ensure, Require } from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { type MovieDto, MoviesService } from '#core'
import {
    type AssetPresignedUploadDto,
    AssetsService,
    AssetPresignedUploadSchema
} from '#infrastructure'
import {
    buildCreateAssetDto,
    createMovieAsset,
    createUnpublishedMovie,
    Errors,
    overrideConfigGetter,
    testAssets,
    uploadAndFinalizeMovieAsset,
    uploadAsset,
    type AppTestContext,
    createAppTestContext
} from '../helpers/index.js'
import { AdminAuthGuard } from '#gateway'
import { MoviesRepository } from '../../services/core/movies/movies.repository.js'
import { MoviePendingAssetsRepository } from '../../services/core/movies/movie-pending-assets.repository.js'

describe('MoviesAssets', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let assetsService: AssetsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext({ ignoreGuards: [AdminAuthGuard] })
        teardown = fix.teardown
        assetsService = fix.module.get(AssetsService)
    })
    afterEach(() => teardown?.())

    describe('POST /movies/:movieId/assets', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
        })

        it('에셋 생성을 요청하면 업로드 URL이 포함된 정보를 반환한다', async () => {
            const createDto = buildCreateAssetDto(testAssets.image)

            const { body } = await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .body(createDto)
                .created({ schema: AssetPresignedUploadSchema })

            expect(body).toEqual(
                expect.objectContaining({
                    assetId: expect.any(String),
                    expiresAt: expect.any(Temporal.Instant),
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
                .created({ schema: AssetPresignedUploadSchema })

            const response = await uploadAsset(testAssets.image.path, upload)

            expect(response.ok).toBe(true)
        })

        describe('에셋의 MIME 타입을 지원하지 않으면', () => {
            let request: typeof fix.httpClient
            let createDto: ReturnType<typeof buildCreateAssetDto>
            beforeEach(() => {
                createDto = buildCreateAssetDto(testAssets.json)
                request = fix.httpClient.post(`/movies/${movie.id}/assets`).body(createDto)
            })
            it('업로드 URL을 요청하면 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.Movies.UnsupportedAssetType(createDto.mimeType)
                })
            })
        })

        describe('영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                const createDto = buildCreateAssetDto(testAssets.image)
                request = fix.httpClient.post(`/movies/${nullObjectId}/assets`).body(createDto)
            })
            it('업로드 URL을 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Movies.NotFound(nullObjectId) })
            })
        })
    })

    describe('DELETE /movies/:movieId/assets/:assetId', () => {
        describe('업로드와 영화 연결이 완료된 에셋이 있으면', () => {
            let movie: MovieDto
            let assetId: string
            let downloadUrl: string

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                assetId = await uploadAndFinalizeMovieAsset(fix, movie.id)
                const asset = ensure((await assetsService.getMany([assetId]))[0])
                Require.defined(asset.download)
                downloadUrl = asset.download.url
            })

            it('에셋을 삭제하면 204를 반환하고 에셋 URL을 무효화한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()

                const response = await fetch(downloadUrl)
                expect(response.status).toBe(404)
            })
        })

        describe('에셋이 없는 영화가 있으면', () => {
            let movie: MovieDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })
            it('존재하지 않는 에셋 ID로 삭제를 요청해도 204를 반환한다', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${nullObjectId}`)
                    .noContent()
            })
        })

        describe('영화에 업로드 대기 중인 에셋이 있으면', () => {
            let movie: MovieDto
            let upload: AssetPresignedUploadDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                upload = await createMovieAsset(fix, movie.id, testAssets.image)
            })
            it('에셋 삭제 요청에 204를 반환하고 에셋을 제거한다', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                    .noContent()

                await expect(assetsService.getMany([upload.assetId])).rejects.toThrow()
            })
        })

        describe('서로 다른 영화와 한 영화가 소유한 에셋이 있으면', () => {
            let movie: MovieDto
            let ownerMovie: MovieDto
            let assetId: string
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                ownerMovie = await createUnpublishedMovie(fix)
                assetId = await uploadAndFinalizeMovieAsset(fix, ownerMovie.id)
            })
            it('다른 영화의 ID로 에셋 삭제를 요청하면 404를 반환하고 소유 정보를 유지한다', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${assetId}`)
                    .notFound({ expected: Errors.Movies.AssetNotFound(assetId) })

                const [asset] = await assetsService.getMany([assetId])
                expect(asset?.owner).toEqual({ entityId: ownerMovie.id, service: 'movies' })
            })
        })

        describe('다른 영화 소유의 에셋이 잘못 연결되어 있으면', () => {
            let movie: MovieDto
            let ownerMovie: MovieDto
            let assetId: string
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                ownerMovie = await createUnpublishedMovie(fix)
                assetId = await uploadAndFinalizeMovieAsset(fix, ownerMovie.id)
                const moviesRepository = fix.module.get(MoviesRepository)
                await moviesRepository.addAsset(movie.id, assetId)
            })
            it('에셋 삭제 요청에 404를 반환하고 소유 정보를 유지한다', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${assetId}`)
                    .notFound({ expected: Errors.Movies.AssetNotFound(assetId) })

                const [asset] = await assetsService.getMany([assetId])
                expect(asset?.owner).toEqual({ entityId: ownerMovie.id, service: 'movies' })
            })
        })

        describe('영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
            })
            it('에셋 삭제를 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Movies.NotFound(nullObjectId) })
            })
        })
    })

    describe('DELETE /movies/:movieId', () => {
        describe('다른 영화 소유의 에셋이 잘못 연결되어 있으면', () => {
            let movie: MovieDto
            let ownerMovie: MovieDto
            let assetId: string
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                ownerMovie = await createUnpublishedMovie(fix)
                assetId = await uploadAndFinalizeMovieAsset(fix, ownerMovie.id)
                const moviesRepository = fix.module.get(MoviesRepository)
                await moviesRepository.addAsset(movie.id, assetId)
            })
            it('영화를 삭제해도 다른 영화의 에셋과 소유 정보를 유지한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                const [asset] = await assetsService.getMany([assetId])
                expect(asset?.owner).toEqual({ entityId: ownerMovie.id, service: 'movies' })
            })
        })

        describe('영화에 업로드 대기 중인 에셋이 있으면', () => {
            let movie: MovieDto
            let upload: AssetPresignedUploadDto
            let pendingAssetsRepository: MoviePendingAssetsRepository
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                upload = await createMovieAsset(fix, movie.id, testAssets.image)
                pendingAssetsRepository = fix.module.get(MoviePendingAssetsRepository)
            })
            it('영화를 삭제하면 에셋과 업로드 대기 기록도 삭제한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).noContent()

                await expect(assetsService.getMany([upload.assetId])).rejects.toThrow()
                await expect(
                    pendingAssetsRepository.hasPendingAsset(movie.id, upload.assetId)
                ).resolves.toBe(false)
            })
        })
    })

    describe('POST /movies/:movieId/assets/:assetId/finalize', () => {
        describe('S3에 업로드한 에셋이 존재하면', () => {
            let movie: MovieDto
            let upload: AssetPresignedUploadDto

            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                upload = await createMovieAsset(fix, movie.id, testAssets.image)

                const uploadResponse = await uploadAsset(testAssets.image.path, upload)
                expect(uploadResponse.ok).toBe(true)
            })

            // 공개 GET은 draft를 404로 숨기므로, draft 상태의 결과 확인은 서비스로 조회한다.
            const getImageUrls = async () => {
                const moviesService = fix.module.get(MoviesService)
                const [found] = await moviesService.getMany([movie.id])
                return found?.imageUrls
            }

            it('업로드 완료 처리를 요청하면 204를 반환하고 영화의 imageUrls에 에셋을 추가한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .noContent()

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })

            describe('에셋의 영화 연결이 이미 완료되어 있으면', () => {
                beforeEach(async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .noContent()
                })
                it('완료 처리를 다시 요청해도 이미지가 중복으로 추가되지 않는다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .noContent()

                    await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
                })
            })

            describe('소유권 부여 후 영화 연결에 실패했고 업로드 기한도 지났으면', () => {
                beforeEach(async () => {
                    const repository = fix.module.get(MoviesRepository)
                    const moviesService = fix.module.get(MoviesService)
                    vi.spyOn(repository, 'addAsset').mockRejectedValueOnce(
                        new Error('movie write failed')
                    )
                    await expect(
                        moviesService.finalizeUpload(movie.id, upload.assetId)
                    ).rejects.toThrow('movie write failed')
                    await expect(assetsService.findOwner(upload.assetId)).resolves.toEqual({
                        entityId: movie.id,
                        service: 'movies'
                    })
                    await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
                })
                it('완료 처리를 다시 요청하면 파일을 영화에 연결한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .noContent()
                    await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
                    await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
                })
            })

            it('동시에 여러 번 호출해도 에셋은 한 번만 추가된다', async () => {
                // 동시에 완료 처리를 요청해 이미지가 중복으로 연결되는지 확인한다.
                // 다른 요청이 pending을 먼저 제거한 경우의 404(AssetNotFound)만 허용한다.
                const finalize = () =>
                    fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .sendRaw()

                const responses = await Promise.all(Array.from({ length: 8 }, finalize))
                expect(responses.some(({ status }) => status === 204)).toBe(true)
                for (const response of responses) {
                    if (response.status === 204) continue
                    expect(response.status).toBe(404)
                    expect(response.body).toEqual(Errors.Movies.AssetNotFound(upload.assetId))
                }

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })
        })

        describe('업로드 대기 중인 에셋이 있으면', () => {
            let movie: MovieDto
            let upload: AssetPresignedUploadDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                upload = await createMovieAsset(fix, movie.id, testAssets.image)
            })
            it('완료 처리 요청에 422를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .unprocessableEntity({
                        expected: Errors.Movies.AssetUploadInvalid(upload.assetId)
                    })
            })
        })

        describe('에셋이 없는 영화가 있으면', () => {
            let movie: MovieDto
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
            })
            it('존재하지 않는 에셋 ID로 완료 처리를 요청하면 404를 반환한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${nullObjectId}/finalize`)
                    .notFound({ expected: Errors.Movies.AssetNotFound(nullObjectId) })
            })
        })

        describe('영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.post(
                    `/movies/${nullObjectId}/assets/${nullObjectId}/finalize`
                )
            })
            it('에셋 업로드 완료 처리를 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Movies.NotFound(nullObjectId) })
            })
        })
    })
})
