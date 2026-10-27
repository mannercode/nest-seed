import { Checksum, ensure, Require, S3ObjectService } from '@mannercode/common'
import { readFile } from 'node:fs/promises'
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
    pauseNextMovieAssetAttachment,
    pauseNextPendingAssetLookup,
    testAssets,
    uploadAndFinalizeMovieAsset,
    uploadAsset,
    uploadMovieAsset,
    type AppTestContext,
    createAppTestContext,
    createAndLoginAdmin,
    createAndLoginUser,
    createAdmin,
    loginAdmin
} from '../helpers/index.js'
import { MoviesRepository } from '../../services/core/movies/movies.repository.js'
import { MoviePendingAssetsRepository } from '../../services/core/movies/movie-pending-assets.repository.js'
import { AssetsRepository } from '../../services/infrastructure/assets/assets.repository.js'

describe('MoviesAssets', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let adminAuth: { Authorization: string }
    let assetsService: AssetsService

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        const { accessToken } = await createAndLoginAdmin(fix)
        adminAuth = { Authorization: `Bearer ${accessToken}` }
        assetsService = fix.module.get(AssetsService)
    })
    afterEach(() => teardown?.())

    describe('한 관리자가 영화 이미지 업로드를 요청했고 다른 관리자도 로그인했으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        let otherAuth: { Authorization: string }
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            const response = await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .headers(adminAuth)
                .body(buildCreateAssetDto())
                .created({ schema: AssetPresignedUploadSchema })
            upload = response.body
            expect((await uploadAsset(testAssets.image.path, upload)).status).toBe(204)
            const credentials = { email: 'other-admin@mail.com', password: 'Example password 1!' }
            await createAdmin(fix, credentials)
            const { accessToken } = await loginAdmin(fix, credentials)
            otherAuth = { Authorization: `Bearer ${accessToken}` }
        })
        it('다른 관리자가 업로드를 확정해도 해당 영화에 정상 연결한다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(otherAuth)
                .noContent()
            await expect(assetsService.findOwner(upload.assetId)).resolves.toEqual({
                entityId: movie.id,
                service: 'movies'
            })
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [upload.assetId] })
        })
        describe('최초 관리자가 영화 연결까지 완료했으면', () => {
            beforeEach(async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .headers(adminAuth)
                    .noContent()
            })
            it('다른 관리자가 삭제를 요청해도 해당 영화의 이미지를 제거할 수 있다', async () => {
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                    .headers(otherAuth)
                    .noContent()
                await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
                await expect(
                    fix.module.get(MoviesRepository).get({ id: movie.id })
                ).resolves.toMatchObject({ assetIds: [] })
            })
        })
    })

    describe('다른 영화에 업로드한 미확정 이미지가 있으면', () => {
        let movie: MovieDto
        let ownerMovie: MovieDto
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            ownerMovie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, ownerMovie.id)
        })
        it('다른 영화 ID로 확정을 요청하면 404를 반환하고 원래 영화의 대기 기록과 파일을 유지한다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(adminAuth)
                .notFound({ expected: Errors.Movies.AssetNotFound(upload.assetId) })
            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeNull()
            await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(ownerMovie.id, upload.assetId)
            ).resolves.toBe(true)
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [] })
        })
        it('다른 영화 ID로 삭제를 요청하면 404를 반환하고 원래 영화의 파일과 대기 기록을 유지한다', async () => {
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .notFound({ expected: Errors.Movies.AssetNotFound(upload.assetId) })
            await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(ownerMovie.id, upload.assetId)
            ).resolves.toBe(true)
        })
        describe('원래 영화에 확정된 이미지 ID가 다른 영화의 연결 목록에도 잘못 들어 있으면', () => {
            beforeEach(async () => {
                await fix.module.get(MoviesService).finalizeUpload(ownerMovie.id, upload.assetId)
                await fix.module.get(MoviesRepository).addAsset(movie.id, upload.assetId)
            })
            it('잘못 연결된 영화에서 확정을 재요청하면 404를 반환하고 기존 소유권과 파일을 유지한다', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .headers(adminAuth)
                    .notFound({ expected: Errors.Mongo.DocumentNotFound(upload.assetId) })
                await expect(assetsService.findOwner(upload.assetId)).resolves.toEqual({
                    entityId: ownerMovie.id,
                    service: 'movies'
                })
                await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
            })
        })
    })

    describe.each([
        { condition: '인증 정보가 없으면', credential: 'guest' },
        { condition: '일반 사용자로 인증했으면', credential: 'user' },
        { condition: '토큰이 잘못되었으면', credential: 'invalid' }
    ] as const)('$condition', ({ credential }) => {
        let headers: Record<string, string>
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            const { accessToken } = await createAndLoginUser(fix)
            headers = {
                guest: {},
                user: { Authorization: `Bearer ${accessToken}` },
                invalid: { Authorization: 'Bearer invalid-token' }
            }[credential]
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
        })
        it('이미지 업로드 요청에 401을 반환하고 자산과 업로드 대기 기록을 추가하지 않는다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .headers(headers)
                .body(buildCreateAssetDto())
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
            await expect(
                fix.module.get(AssetsRepository).countDocuments({ deletedAt: null })
            ).resolves.toBe(1)
            await expect(
                fix.module.get(MoviePendingAssetsRepository).findAssetIds({ movieIds: [movie.id] })
            ).resolves.toEqual([upload.assetId])
        })
        it('이미지 확정 요청에 401을 반환하고 소유권과 영화 연결을 부여하지 않는다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(headers)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeNull()
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [] })
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(true)
        })
        it('이미지 삭제 요청에 401을 반환하고 파일과 업로드 대기 기록을 유지한다', async () => {
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(headers)
                .unauthorized({ expected: Errors.Auth.Unauthorized() })
            await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(true)
        })
    })

    describe('소유권을 부여한 업로드가 영화 연결을 기다리고 있으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        let gate: ReturnType<typeof pauseNextMovieAssetAttachment> | undefined
        let completion: ReturnType<typeof fix.httpClient.sendRaw> | undefined

        beforeEach(async () => {
            gate = undefined
            completion = undefined
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
            gate = pauseNextMovieAssetAttachment(fix)
            completion = fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(adminAuth)
                .sendRaw()
            await gate.started
        })
        afterEach(async () => {
            gate?.release()
            await completion
        })

        it('파일을 삭제한 뒤 완료 처리가 재개되어도 삭제된 파일을 영화에 다시 연결하지 않는다', async () => {
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .noContent()
            ensure(gate).release()
            const response = await ensure(completion)
            expect([204, 404]).toContain(response.status)

            const movieRecord = await fix.module.get(MoviesRepository).get({ id: movie.id })
            expect(movieRecord.assetIds).toEqual([])
            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })

        it('영화를 삭제한 뒤 완료 처리가 재개되어도 파일과 소유·대기 기록을 남기지 않는다', async () => {
            await fix.httpClient.delete(`/movies/${movie.id}`).headers(adminAuth).noContent()
            ensure(gate).release()
            const response = await ensure(completion)
            expect([204, 404]).toContain(response.status)

            await expect(
                fix.module.get(MoviesRepository).find({ id: movie.id })
            ).resolves.toBeNull()
            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })
    })

    describe('미확정 이미지의 S3 삭제가 한 번 실패했으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            vi.spyOn(s3, 'deleteObject').mockRejectedValueOnce(new Error('S3 delete failed'))
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .internalServerError()
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(true)
        })
        it('같은 파일 삭제를 재요청하면 204를 반환하고 파일·자산·대기 기록을 제거한다', async () => {
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .noContent()

            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })
        it('삭제 중인 이미지를 확정하려 하면 404를 반환하고 영화에 연결하지 않는다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(adminAuth)
                .notFound({ expected: Errors.Mongo.DocumentNotFound(upload.assetId) })
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [] })
        })
    })

    describe('영화 삭제가 업로드 대기 목록 조회를 기다리고 있으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        let gate: ReturnType<typeof pauseNextPendingAssetLookup> | undefined
        let deletion: ReturnType<typeof fix.httpClient.sendRaw> | undefined
        beforeEach(async () => {
            gate = undefined
            deletion = undefined
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
            gate = pauseNextPendingAssetLookup(fix)
            deletion = fix.httpClient.delete(`/movies/${movie.id}`).headers(adminAuth).sendRaw()
            await gate.started
        })
        afterEach(async () => {
            gate?.release()
            await deletion
        })
        it('업로드 확정과 영화 삭제가 완료된 뒤 파일과 소유·대기 기록을 남기지 않는다', async () => {
            const response = await fix.httpClient
                .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                .headers(adminAuth)
                .sendRaw()
            expect([204, 404]).toContain(response.status)
            ensure(gate).release()
            expect((await ensure(deletion)).status).toBe(204)

            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })
        it('새 업로드 요청을 거절하고 생성 도중 남은 미확정 자산도 만료 정리로 제거한다', async () => {
            await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .headers(adminAuth)
                .body(buildCreateAssetDto())
                .notFound({ expected: Errors.Movies.NotFound(movie.id) })
            ensure(gate).release()
            expect((await ensure(deletion)).status).toBe(204)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            await fix.module.get(MoviesService).cleanupExpiredUploads()
            await expect(
                fix.module.get(AssetsRepository).countDocuments({ deletedAt: null })
            ).resolves.toBe(0)
            await expect(
                fix.module.get(MoviePendingAssetsRepository).findAllAssetIds()
            ).resolves.toEqual([])
        })
    })

    describe('미확정 이미지의 S3 삭제 후 자산 DB 삭제가 한 번 실패했으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
            vi.spyOn(fix.module.get(AssetsRepository), 'deleteMany').mockRejectedValueOnce(
                new Error('asset write failed')
            )
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .internalServerError()
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })
        it('삭제를 재요청하면 남은 자산 DB와 영화 대기 기록을 제거한다', async () => {
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .noContent()
            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
        })
    })

    describe('확정된 이미지 삭제가 S3에서 한 번 실패했으면', () => {
        let movie: MovieDto
        let assetId: string
        let otherMovie: MovieDto
        let otherAssetId: string
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            assetId = await uploadAndFinalizeMovieAsset(fix, movie.id)
            otherMovie = await createUnpublishedMovie(fix)
            otherAssetId = await uploadAndFinalizeMovieAsset(fix, otherMovie.id)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            vi.spyOn(s3, 'deleteObject').mockRejectedValueOnce(new Error('S3 deletion interrupted'))
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${assetId}`)
                .headers(adminAuth)
                .internalServerError()
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [assetId] })
        })
        it('정리 작업이 남은 삭제와 영화 연결 제거를 마치고 다른 영화의 이미지는 보존한다', async () => {
            await fix.module.get(MoviesService).cleanupExpiredUploads()
            await expect(assetsService.findOwner(assetId)).resolves.toBeUndefined()
            await expect(
                fix.module.get(MoviesRepository).get({ id: movie.id })
            ).resolves.toMatchObject({ assetIds: [] })
            await expect(assetsService.isUploadComplete(otherAssetId)).resolves.toBe(true)
            await expect(
                fix.module.get(MoviesRepository).get({ id: otherMovie.id })
            ).resolves.toMatchObject({ assetIds: [otherAssetId] })
        })
    })

    describe('삭제한 이미지의 업로드 요청이 아직 유효하면', () => {
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            const movie = await createUnpublishedMovie(fix)
            upload = await createMovieAsset(fix, movie.id, testAssets.image)
            await fix.httpClient
                .delete(`/movies/${movie.id}/assets/${upload.assetId}`)
                .headers(adminAuth)
                .noContent()
            const response = await uploadAsset(testAssets.image.path, upload)
            expect(response.status).toBe(204)
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(true)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
        })
        it('업로드 기한 후 정리를 실행하면 뒤늦게 저장된 파일도 제거한다', async () => {
            await assetsService.cleanupExpiredUploads()

            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
        })
    })

    describe('영화 이미지가 업로드된 뒤 확정하지 않은 채 기한이 지났으면', () => {
        let movie: MovieDto
        let upload: AssetPresignedUploadDto
        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
            upload = await uploadMovieAsset(fix, movie.id)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
        })
        it('만료 정리를 실행하면 파일·자산과 영화의 활성 대기 기록을 제거한다', async () => {
            await fix.module.get(MoviesService).cleanupExpiredUploads()

            await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
            const s3 = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(s3.isUploadComplete({ key: upload.assetId })).resolves.toBe(false)
            await expect(
                fix.module
                    .get(MoviePendingAssetsRepository)
                    .hasPendingAsset(movie.id, upload.assetId)
            ).resolves.toBe(false)
        })

        describe('자산 정리 뒤 영화 대기 기록 삭제가 한 번 실패했으면', () => {
            beforeEach(async () => {
                const repository = fix.module.get(MoviePendingAssetsRepository)
                vi.spyOn(repository, 'removeAssets').mockRejectedValueOnce(
                    new Error('pending cleanup interrupted')
                )
                await expect(fix.module.get(MoviesService).cleanupExpiredUploads()).rejects.toThrow(
                    'pending cleanup interrupted'
                )
                await expect(assetsService.findOwner(upload.assetId)).resolves.toBeUndefined()
                await expect(repository.hasPendingAsset(movie.id, upload.assetId)).resolves.toBe(
                    true
                )
            })
            it('다음 정리에서 이미 삭제된 자산의 대기 기록을 다시 찾아 제거한다', async () => {
                await fix.module.get(MoviesService).cleanupExpiredUploads()
                await expect(
                    fix.module
                        .get(MoviePendingAssetsRepository)
                        .hasPendingAsset(movie.id, upload.assetId)
                ).resolves.toBe(false)
            })
        })
    })

    describe('POST /movies/:movieId/assets', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createUnpublishedMovie(fix)
        })

        describe.each(['image/jpeg', 'image/png', 'image/webp'])(
            '신고한 형식이 %s이면',
            (mimeType) => {
                let createDto: ReturnType<typeof buildCreateAssetDto>
                beforeEach(() => {
                    createDto = { ...buildCreateAssetDto(), mimeType }
                })
                it('업로드 URL을 요청하면 같은 형식·크기·체크섬을 요구하는 정책을 반환한다', async () => {
                    const { body } = await fix.httpClient
                        .post(`/movies/${movie.id}/assets`)
                        .headers(adminAuth)
                        .body(createDto)
                        .created({ schema: AssetPresignedUploadSchema })
                    const policy = JSON.parse(
                        Buffer.from(ensure(body.fields.Policy), 'base64').toString('utf8')
                    )
                    expect(policy.conditions).toEqual(
                        expect.arrayContaining([
                            ['eq', '$Content-Type', mimeType],
                            ['content-length-range', createDto.size, createDto.size],
                            ['eq', '$x-amz-checksum-sha256', createDto.checksum.base64]
                        ])
                    )
                })
            }
        )

        describe.each(['image/svg+xml', 'image/gif'])('신고한 형식이 %s이면', (mimeType) => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body({ ...buildCreateAssetDto(), mimeType })
                vi.spyOn(assetsService, 'create')
            })
            it('업로드 URL을 요청하면 400을 반환하고 자산을 생성하지 않는다', async () => {
                await request.badRequest({ expected: Errors.Movies.UnsupportedAssetType(mimeType) })
                expect(assetsService.create).not.toHaveBeenCalled()
            })
        })

        describe('신고한 크기가 5 MiB를 1바이트 초과하면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body({ ...buildCreateAssetDto(), size: 5 * 1024 * 1024 + 1 })
                vi.spyOn(assetsService, 'create')
            })
            it('업로드 URL을 요청하면 400을 반환하고 자산을 생성하지 않는다', async () => {
                await request.badRequest({
                    expected: Errors.Movies.AssetTooLarge(5 * 1024 * 1024 + 1, 5 * 1024 * 1024)
                })
                expect(assetsService.create).not.toHaveBeenCalled()
            })
        })

        describe.each([0, -1, 1.5])('신고한 크기가 %s바이트이면', (size) => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body({ ...buildCreateAssetDto(), size })
            })
            it('업로드 URL을 요청하면 입력 오류로 400을 반환한다', async () => {
                await request.badRequest({
                    expected: Errors.RequestValidation.Failed(expect.any(Array))
                })
            })
        })

        describe('신고한 크기가 1바이트이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body({ ...buildCreateAssetDto(), size: 1 })
            })
            it('업로드 URL을 요청하면 1바이트만 허용하는 정책을 반환한다', async () => {
                const { body } = await request.created({ schema: AssetPresignedUploadSchema })
                const policy = JSON.parse(
                    Buffer.from(ensure(body.fields.Policy), 'base64').toString('utf8')
                )
                expect(policy.conditions).toContainEqual(['content-length-range', 1, 1])
            })
        })

        describe('업로드할 이미지의 크기가 정확히 5 MiB이면', () => {
            let upload: AssetPresignedUploadDto
            let form: FormData
            beforeEach(async () => {
                const image = await readFile(testAssets.image.path)
                const content = Buffer.concat([image, Buffer.alloc(5 * 1024 * 1024 - image.length)])
                const createDto = {
                    ...buildCreateAssetDto(),
                    size: content.length,
                    checksum: Checksum.fromBuffer(content)
                }
                ;({ body: upload } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body(createDto)
                    .created({ schema: AssetPresignedUploadSchema }))
                form = new FormData()
                for (const [name, value] of Object.entries(upload.fields)) form.append(name, value)
                form.append(
                    'file',
                    new Blob([content], { type: createDto.mimeType }),
                    createDto.originalName
                )
            })
            it('업로드하면 스토리지에 저장하고 영화에 연결할 수 있다', async () => {
                const response = await fetch(upload.url, { method: 'POST', body: form })
                expect(response.status).toBe(204)
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                    .headers(adminAuth)
                    .noContent()
                expect(ensure((await assetsService.getMany([upload.assetId]))[0])).toMatchObject({
                    size: 5 * 1024 * 1024,
                    owner: { service: 'movies', entityId: movie.id }
                })
            })
        })

        describe('발급한 업로드 요청의 체크섬 필드를 제거했으면', () => {
            let upload: AssetPresignedUploadDto
            let form: FormData
            beforeEach(async () => {
                upload = await createMovieAsset(fix, movie.id, testAssets.image)
                form = new FormData()
                for (const [name, value] of Object.entries(upload.fields)) form.append(name, value)
                form.delete('x-amz-checksum-sha256')
                form.append(
                    'file',
                    new Blob([await readFile(testAssets.image.path)], { type: 'image/png' }),
                    'image.png'
                )
            })
            it('업로드하면 스토리지가 거절하고 파일은 미완료 상태로 남는다', async () => {
                const response = await fetch(upload.url, { method: 'POST', body: form })
                expect(response.status).toBe(403)
                expect(await assetsService.isUploadComplete(upload.assetId)).toBe(false)
            })
        })

        describe('발급한 업로드 요청의 형식 필드를 다른 허용 형식으로 바꿨으면', () => {
            let upload: AssetPresignedUploadDto
            let form: FormData
            beforeEach(async () => {
                upload = await createMovieAsset(fix, movie.id, testAssets.image)
                form = new FormData()
                for (const [name, value] of Object.entries(upload.fields)) form.append(name, value)
                form.set('Content-Type', 'image/jpeg')
                form.append(
                    'file',
                    new Blob([await readFile(testAssets.image.path)], { type: 'image/jpeg' }),
                    'image.jpg'
                )
            })
            it('업로드하면 스토리지가 거절하고 파일은 미완료 상태로 남는다', async () => {
                const response = await fetch(upload.url, { method: 'POST', body: form })
                expect(response.status).toBe(403)
                expect(await assetsService.isUploadComplete(upload.assetId)).toBe(false)
            })
        })

        it('에셋 생성을 요청하면 업로드 URL이 포함된 정보를 반환한다', async () => {
            const createDto = buildCreateAssetDto(testAssets.image)

            const { body } = await fix.httpClient
                .post(`/movies/${movie.id}/assets`)
                .headers(adminAuth)
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
                .headers(adminAuth)
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
                request = fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .headers(adminAuth)
                    .body(createDto)
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
                request = fix.httpClient
                    .post(`/movies/${nullObjectId}/assets`)
                    .headers(adminAuth)
                    .body(createDto)
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
                await fix.httpClient
                    .delete(`/movies/${movie.id}/assets/${assetId}`)
                    .headers(adminAuth)
                    .noContent()

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
                    .headers(adminAuth)
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
                    .headers(adminAuth)
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
                    .headers(adminAuth)
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
                    .headers(adminAuth)
                    .notFound({ expected: Errors.Movies.AssetNotFound(assetId) })

                const [asset] = await assetsService.getMany([assetId])
                expect(asset?.owner).toEqual({ entityId: ownerMovie.id, service: 'movies' })
            })
        })

        describe('영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
                    .headers(adminAuth)
            })
            it('에셋 삭제를 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Movies.NotFound(nullObjectId) })
            })
        })
    })

    describe('DELETE /movies/:movieId', () => {
        describe('영화에 연결된 여러 이미지 중 첫 S3 삭제만 실패했으면', () => {
            let movie: MovieDto
            let assetIds: string[]
            let otherAssetId: string
            beforeEach(async () => {
                movie = await createUnpublishedMovie(fix)
                assetIds = await Promise.all([
                    uploadAndFinalizeMovieAsset(fix, movie.id),
                    uploadAndFinalizeMovieAsset(fix, movie.id)
                ])
                const otherMovie = await createUnpublishedMovie(fix)
                otherAssetId = await uploadAndFinalizeMovieAsset(fix, otherMovie.id)
                const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                vi.spyOn(storage, 'deleteObject').mockRejectedValueOnce(
                    new Error('one image delete failed')
                )
                await fix.httpClient
                    .delete(`/movies/${movie.id}`)
                    .headers(adminAuth)
                    .internalServerError()
                await expect(
                    fix.module.get(MoviesRepository).get({ id: movie.id })
                ).resolves.toMatchObject({
                    assetIds: expect.arrayContaining(assetIds),
                    deletionRequestedAt: expect.any(Temporal.Instant)
                })
            })
            it('영화 삭제를 재요청하면 남은 이미지와 영화를 제거하고 다른 영화의 이미지는 보존한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).headers(adminAuth).noContent()
                await expect(
                    fix.module.get(MoviesRepository).find({ id: movie.id })
                ).resolves.toBeNull()
                await expect(assetsService.findMany(assetIds)).resolves.toEqual([])
                const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                for (const assetId of assetIds) {
                    await expect(storage.isUploadComplete({ key: assetId })).resolves.toBe(false)
                }
                await expect(assetsService.isUploadComplete(otherAssetId)).resolves.toBe(true)
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
            it('영화를 삭제해도 다른 영화의 에셋과 소유 정보를 유지한다', async () => {
                await fix.httpClient.delete(`/movies/${movie.id}`).headers(adminAuth).noContent()

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
                await fix.httpClient.delete(`/movies/${movie.id}`).headers(adminAuth).noContent()

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
                    .headers(adminAuth)
                    .noContent()

                await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
            })

            describe('에셋의 영화 연결이 이미 완료되어 있으면', () => {
                beforeEach(async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
                        .noContent()
                })
                it('완료 처리를 다시 요청해도 이미지가 중복으로 추가되지 않는다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
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
                    await moviesService.cleanupExpiredUploads()
                })
                it('완료 처리를 다시 요청하면 파일을 영화에 연결한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
                        .noContent()
                    await expect(getImageUrls()).resolves.toEqual([expect.any(String)])
                    await expect(assetsService.isUploadComplete(upload.assetId)).resolves.toBe(true)
                })
            })

            describe('영화 연결 뒤 대기 기록 제거가 한 번 실패했으면', () => {
                beforeEach(async () => {
                    vi.spyOn(
                        fix.module.get(MoviePendingAssetsRepository),
                        'removePendingAsset'
                    ).mockRejectedValueOnce(new Error('pending write failed'))
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
                        .internalServerError()
                    await expect(
                        fix.module.get(MoviesRepository).get({ id: movie.id })
                    ).resolves.toMatchObject({ assetIds: [] })
                    await expect(assetsService.findOwner(upload.assetId)).resolves.toEqual({
                        entityId: movie.id,
                        service: 'movies'
                    })
                })
                it('확정을 재요청하면 영화에 한 번만 연결하고 대기 기록을 제거한다', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
                        .noContent()
                    await expect(
                        fix.module.get(MoviesRepository).get({ id: movie.id })
                    ).resolves.toMatchObject({ assetIds: [upload.assetId] })
                    await expect(
                        fix.module
                            .get(MoviePendingAssetsRepository)
                            .hasPendingAsset(movie.id, upload.assetId)
                    ).resolves.toBe(false)
                })
            })

            it('동시에 여러 번 호출해도 에셋은 한 번만 추가된다', async () => {
                // 동시에 완료 처리를 요청해 이미지가 중복으로 연결되는지 확인한다.
                // 다른 요청이 pending을 먼저 제거한 경우의 404(AssetNotFound)만 허용한다.
                const finalize = () =>
                    fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/finalize`)
                        .headers(adminAuth)
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
                    .headers(adminAuth)
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
                    .headers(adminAuth)
                    .notFound({ expected: Errors.Movies.AssetNotFound(nullObjectId) })
            })
        })

        describe('영화가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post(`/movies/${nullObjectId}/assets/${nullObjectId}/finalize`)
                    .headers(adminAuth)
            })
            it('에셋 업로드 완료 처리를 요청하면 404를 반환한다', async () => {
                await request.notFound({ expected: Errors.Movies.NotFound(nullObjectId) })
            })
        })
    })
})
