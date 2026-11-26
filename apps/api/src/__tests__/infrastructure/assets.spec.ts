import { SchedulerRegistry } from '@nestjs/schedule'
import {
    CacheService,
    Checksum,
    DateUtil,
    ensure,
    pickIds,
    S3ObjectService,
    sleep
} from '@mannercode/common'
import { nullObjectId } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { type AssetDto, type AssetPresignedUploadDto, AssetsService } from '#infrastructure'
import {
    buildCreateAssetDto,
    buildFinalizeAssetDto,
    createAsset,
    downloadAsset,
    failNextMongoUpdateAfterStorageDelete,
    overrideConfigGetter,
    pauseNextMongoFindOneAndUpdate,
    pauseNextStorageDelete,
    testAssets,
    uploadAndFinalizeAsset,
    uploadAsset,
    uploadFile,
    type AppTestContext,
    createAppTestContext
} from '#test-helpers'
import { AppConfigService } from '#config'

type UploadedFile = Awaited<ReturnType<typeof uploadFile>>

describe('AssetsService', () => {
    let fix: AppTestContext
    let teardown: AppTestContext['teardown'] | undefined
    let assetsService: AssetsService
    let scheduler: SchedulerRegistry
    const file = testAssets.small

    beforeEach(async () => {
        teardown = undefined

        fix = await createAppTestContext()
        teardown = fix.teardown
        assetsService = fix.module.get(AssetsService)
        scheduler = fix.module.get(SchedulerRegistry)
    })
    afterEach(() => teardown?.())

    describe('두 파일 중 하나만 S3에서 삭제하지 못했으면', () => {
        let files: UploadedFile[]
        let ids: string[]
        let storage: S3ObjectService
        beforeEach(async () => {
            files = await Promise.all([uploadFile(fix, file), uploadFile(fix, file)])
            ids = files.map(({ assetId }) => assetId)
            await Promise.all(
                ids.map((id) => assetsService.finalizeUpload(id, buildFinalizeAssetDto()))
            )
            storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            const failedKey = ensure(files[0]).key
            const failure = new Error('one S3 delete failed')
            const deleteObject = storage.deleteObject.bind(storage)
            using deletion = vi.spyOn(storage, 'deleteObject')
            deletion.mockImplementation(async (key) => {
                if (key === failedKey) throw failure
                return deleteObject(key)
            })
            await expect(assetsService.deleteMany(ids)).rejects.toBe(failure)
            await expect(assetsService.getMany(ids)).resolves.toHaveLength(2)
            await expect(storage.isUploadComplete({ key: ensure(files[0]).key })).resolves.toBe(
                true
            )
            await expect(storage.isUploadComplete({ key: ensure(files[1]).key })).resolves.toBe(
                false
            )
        })
        it('같은 삭제를 재요청하면 남은 파일과 두 자산 기록을 모두 제거한다', async () => {
            await assetsService.deleteMany(ids)
            await expect(assetsService.findMany(ids)).resolves.toEqual([])
            for (const { key } of files) {
                await expect(storage.isUploadComplete({ key })).resolves.toBe(false)
            }
        })
    })

    describe('파일 삭제 후 자산 DB 삭제가 한 번 실패했으면', () => {
        let uploaded: UploadedFile
        beforeEach(async () => {
            uploaded = await uploadFile(fix, file)
            await assetsService.finalizeUpload(uploaded.assetId, buildFinalizeAssetDto())
            const failure = failNextMongoUpdateAfterStorageDelete(fix)
            await expect(assetsService.deleteMany([uploaded.assetId])).rejects.toBe(failure)
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
            await expect(assetsService.getMany([uploaded.assetId])).resolves.toHaveLength(1)
        })
        it('삭제를 재요청하면 이미 없는 파일도 처리하고 남은 DB 기록을 제거한다', async () => {
            await assetsService.deleteMany([uploaded.assetId])
            await expect(assetsService.findMany([uploaded.assetId])).resolves.toEqual([])
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
        })
    })

    describe('만료 정리가 S3 삭제에서 한 번 실패했으면', () => {
        let uploaded: UploadedFile
        let owned: AssetDto
        beforeEach(async () => {
            uploaded = await uploadFile(fix, file)
            owned = await uploadAndFinalizeAsset(fix, file)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            vi.spyOn(storage, 'deleteObject').mockRejectedValueOnce(
                new Error('cleanup interrupted')
            )
            await expect(assetsService.cleanupExpiredUploads()).rejects.toThrow(
                'cleanup interrupted'
            )
            await expect(assetsService.getMany([uploaded.assetId])).resolves.toHaveLength(1)
        })
        it('정리를 재실행하면 미확정 파일만 삭제하고 소유권이 있는 파일은 보존한다', async () => {
            await assetsService.cleanupExpiredUploads()
            await expect(assetsService.findMany([uploaded.assetId])).resolves.toEqual([])
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
            await expect(assetsService.isUploadComplete(owned.id)).resolves.toBe(true)
            await expect(assetsService.findOwner(owned.id)).resolves.toEqual(owned.owner)
        })
    })

    describe('S3 정리 뒤 DB 삭제 전에 중단된 앱을 다시 만들었으면', () => {
        let uploaded: UploadedFile
        let owned: AssetDto
        beforeEach(async () => {
            uploaded = await uploadFile(fix, file)
            owned = await uploadAndFinalizeAsset(fix, file)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            const failure = failNextMongoUpdateAfterStorageDelete(fix)
            await expect(assetsService.cleanupExpiredUploads()).rejects.toBe(failure)
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
            await expect(assetsService.getMany([uploaded.assetId])).resolves.toHaveLength(1)

            await fix.teardown()
            teardown = undefined
            fix = await createAppTestContext()
            teardown = fix.teardown
            assetsService = fix.module.get(AssetsService)
        })
        it('새 앱의 정리가 DB에 남은 삭제 요청을 이어 처리하고 완료된 파일은 유지한다', async () => {
            await assetsService.cleanupExpiredUploads()
            await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeUndefined()
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
            await expect(assetsService.isUploadComplete(owned.id)).resolves.toBe(true)
        })
    })

    describe('만료 전에 시작한 소유권 부여가 DB 쓰기를 기다리는 동안 만료 정리가 시작됐으면', () => {
        let uploaded: UploadedFile
        let ownerGate: ReturnType<typeof pauseNextMongoFindOneAndUpdate> | undefined
        let storageGate: ReturnType<typeof pauseNextStorageDelete> | undefined
        let completion: Promise<PromiseSettledResult<AssetDto>> | undefined
        let cleanup: Promise<void> | undefined
        beforeEach(async () => {
            ownerGate = undefined
            storageGate = undefined
            completion = undefined
            cleanup = undefined
            uploaded = await uploadFile(fix, file)
            ownerGate = pauseNextMongoFindOneAndUpdate()
            completion = Promise.allSettled([
                assetsService.finalizeUpload(uploaded.assetId, buildFinalizeAssetDto())
            ]).then((results) => ensure(results[0]))
            await ownerGate.started
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            storageGate = pauseNextStorageDelete(fix)
            cleanup = assetsService.cleanupExpiredUploads()
            await storageGate.started
        })
        afterEach(async () => {
            ownerGate?.release()
            storageGate?.release()
            await Promise.all([completion, cleanup])
        })
        it('소유권 부여를 재개하면 404 예외를 던지고 정리는 파일과 자산을 제거한다', async () => {
            ensure(ownerGate).release()
            expect(await ensure(completion)).toMatchObject({
                status: 'rejected',
                reason: { status: 404 }
            })
            ensure(storageGate).release()
            await cleanup
            await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeUndefined()
            const storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
        })
    })

    describe('만료된 업로드와 완료된 파일이 있으면', () => {
        let uploaded: UploadedFile
        let owned: AssetDto
        let gate: ReturnType<typeof pauseNextStorageDelete> | undefined
        let cleanup: Promise<void> | undefined
        let storage: S3ObjectService
        async function startCleanupUntilDelete() {
            cleanup = assetsService.cleanupExpiredUploads()
            await ensure(gate).started
        }

        beforeEach(async () => {
            gate = undefined
            cleanup = undefined
            uploaded = await uploadFile(fix, file)
            owned = await uploadAndFinalizeAsset(fix, file)
            await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            gate = pauseNextStorageDelete(fix)
        })
        afterEach(async () => {
            gate?.release()
            await cleanup
        })
        describe('첫 번째 정리가 락을 보유한 채 파일 삭제를 기다리면', () => {
            beforeEach(startCleanupUntilDelete)
            it('다른 정리가 반환해도 파일과 기록은 첫 번째 정리가 재개될 때까지 남는다', async () => {
                await assetsService.cleanupExpiredUploads()
                await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(true)
                await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeNull()
                ensure(gate).release()
                await cleanup
                await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
                await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeUndefined()
                await expect(assetsService.isUploadComplete(owned.id)).resolves.toBe(true)
            })
        })

        describe('첫 번째 정리가 파일 삭제를 기다리는 동안 락이 만료되면', () => {
            beforeEach(async () => {
                const ttlMs = 1
                const cache = fix.module.get<CacheService>(CacheService.getName('assets'))
                const withLock = cache.withLock.bind(cache)
                using lock = vi.spyOn(cache, 'withLock')
                lock.mockImplementationOnce((key, _ttl, work) => withLock(key, ttlMs, work))
                await startCleanupUntilDelete()
                await sleep(ttlMs)
            })
            it('두 번째 정리가 먼저 만료 파일과 기록을 제거하고 두 정리 모두 완료 파일을 보존한다', async () => {
                await assetsService.cleanupExpiredUploads()
                await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
                await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeUndefined()
                ensure(gate).release()
                await cleanup
                await expect(storage.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
                await expect(assetsService.findOwner(uploaded.assetId)).resolves.toBeUndefined()
                await expect(assetsService.isUploadComplete(owned.id)).resolves.toBe(true)
            })
        })
    })

    describe('파일을 삭제한 뒤 아직 유효한 업로드 URL로 같은 파일을 다시 올렸으면', () => {
        let key: string
        let storage: S3ObjectService
        beforeEach(async () => {
            storage = fix.module.get<S3ObjectService>(S3ObjectService.getName())
            const upload = await createAsset(fix, file)
            key = ensure(upload.fields.key)
            expect((await uploadAsset(file.path, upload)).ok).toBe(true)
            await assetsService.finalizeUpload(upload.assetId, buildFinalizeAssetDto())
            const deletedAt = DateUtil.now()
            const now = vi.spyOn(DateUtil, 'now').mockReturnValue(deletedAt)
            await assetsService.deleteMany([upload.assetId])
            await expect(storage.isUploadComplete({ key })).resolves.toBe(false)
            expect((await uploadAsset(file.path, upload)).ok).toBe(true)
            const cleanupAt = DateUtil.add({
                base: deletedAt,
                seconds: fix.module.get(AppConfigService).asset.uploadExpiresInSec
            })
            now.mockReturnValue(DateUtil.add({ base: cleanupAt, milliseconds: -1 }))
            await assetsService.cleanupExpiredUploads()
            await expect(storage.isUploadComplete({ key })).resolves.toBe(true)
            now.mockReturnValue(cleanupAt)
        })
        it('삭제 유예기간이 끝나면 다시 올라온 파일을 지우고 다음 정리는 S3 삭제 장애 중에도 완료한다', async () => {
            await assetsService.cleanupExpiredUploads()
            await expect(storage.isUploadComplete({ key })).resolves.toBe(false)
            vi.spyOn(storage, 'deleteObject').mockRejectedValue(new Error('S3 delete unavailable'))
            await expect(assetsService.cleanupExpiredUploads()).resolves.toBeUndefined()
        })
    })

    describe('create', () => {
        it('업로드 요청을 반환한다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            expect(uploadRequest).toEqual({
                assetId: expect.any(String),
                expiresAt: expect.any(Temporal.Instant),
                fields: expect.any(Object),
                method: 'POST',
                url: expect.any(String)
            })

            expect(uploadRequest.fields).toEqual(
                expect.objectContaining({
                    'Content-Type': createDto.mimeType,
                    key: uploadRequest.assetId
                })
            )
        })

        it('반환된 업로드 요청으로 파일을 업로드할 수 있다', async () => {
            const createDto = buildCreateAssetDto(file)
            const uploadRequest = await assetsService.create(createDto)

            const uploadRes = await uploadAsset(file.path, uploadRequest)
            expect(uploadRes.ok).toBe(true)
        })

        describe('업로드할 파일의 체크섬이 발급 시 지정한 값과 다르면', () => {
            let uploadRequest: AssetPresignedUploadDto
            let form: FormData
            beforeEach(async () => {
                const createDto = buildCreateAssetDto(file)
                uploadRequest = await assetsService.create(createDto)

                // size 검증(content-length-range)에 걸리지 않도록 길이는 같고 내용만 다른 본문을 쓴다.
                const tampered = Buffer.alloc(createDto.size, 'x')
                form = new FormData()
                Object.entries(uploadRequest.fields).forEach(([key, value]) => {
                    form.append(key, value)
                })
                form.append('file', new Blob([tampered], { type: createDto.mimeType }), 'tampered')
            })
            it('업로드하면 400과 체크섬 불일치 사유를 반환한다', async () => {
                const uploadRes = await fetch(uploadRequest.url, { body: form, method: 'POST' })
                expect(uploadRes.status).toBe(400)
                expect(await uploadRes.text()).toContain('<Code>BadDigest</Code>')
            })
        })

        describe('업로드 URL이 만료되었을 때', () => {
            let uploadRequest: AssetPresignedUploadDto

            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 1 })

                const createDto = buildCreateAssetDto(file)
                uploadRequest = await assetsService.create(createDto)

                await sleep(1500)
            })

            it('만료된 URL로 업로드하면 클라이언트 오류를 반환한다', async () => {
                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.status).toBeGreaterThanOrEqual(400)
                expect(uploadRes.status).toBeLessThan(500)
            })
        })
    })

    describe('isUploadComplete', () => {
        describe('S3에 업로드한 에셋이 존재하면', () => {
            let assetId: string
            beforeEach(async () => {
                assetId = (await uploadFile(fix, file)).assetId
            })
            it('업로드 완료 여부를 조회하면 true를 반환한다', async () => {
                const isCompleted = await assetsService.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        describe('업로드 대기 중인 에셋이 존재하면', () => {
            let asset: AssetPresignedUploadDto
            beforeEach(async () => {
                asset = await createAsset(fix, file)
            })
            it('업로드 완료 여부를 조회하면 false를 반환한다', async () => {
                const isCompleted = await assetsService.isUploadComplete(asset.assetId)
                expect(isCompleted).toBe(false)
            })
        })
    })

    describe('finalizeUpload', () => {
        describe('업로드가 완료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = (await uploadFile(fix, file)).assetId
            })

            it('업로드 완료 처리를 요청하면 다운로드 정보를 반환하고 파일의 체크섬을 유지한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()

                const asset = await assetsService.finalizeUpload(assetId, finalizeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...finalizeDto,
                        download: {
                            expiresAt: expect.any(Temporal.Instant),
                            url: expect.any(String)
                        }
                    })
                )
                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('업로드가 만료되었을 때', () => {
            let assetId: string

            beforeEach(async () => {
                const createdAsset = await assetsService.create(buildCreateAssetDto(file))
                assetId = createdAsset.assetId
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })

            it('완료 처리에 404 예외를 던지고 남겨 둔 기록은 만료 정리로 삭제한다', async () => {
                const finalizeDto = buildFinalizeAssetDto()
                await expect(
                    assetsService.finalizeUpload(assetId, finalizeDto)
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
                await expect(assetsService.getMany([assetId])).resolves.toMatchObject([
                    { id: assetId, owner: null }
                ])
                await assetsService.cleanupExpiredUploads()
                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        describe('소유자가 확정된 에셋의 업로드 기한이 지났으면', () => {
            let assetId: string
            let finalizeDto: ReturnType<typeof buildFinalizeAssetDto>
            beforeEach(async () => {
                assetId = (await uploadFile(fix, file)).assetId
                finalizeDto = buildFinalizeAssetDto()
                await assetsService.finalizeUpload(assetId, finalizeDto)
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })
            it('같은 소유자로 완료 처리를 재요청해도 소유권을 유지하고 만료 정리에서 파일을 보존한다', async () => {
                await expect(
                    assetsService.finalizeUpload(assetId, finalizeDto)
                ).resolves.toMatchObject({ id: assetId, owner: finalizeDto.owner })
                await assetsService.cleanupExpiredUploads()
                await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
            })
        })

        describe('소유자가 확정된 에셋이 존재하면', () => {
            let assetId: string
            let original: ReturnType<typeof buildFinalizeAssetDto>
            beforeEach(async () => {
                assetId = (await uploadFile(fix, file)).assetId
                original = buildFinalizeAssetDto()
                await assetsService.finalizeUpload(assetId, original)
            })
            it('다른 소유자로 완료 처리를 요청하면 409 예외를 던지고 기존 소유권과 파일을 유지한다', async () => {
                const other = { owner: { ...original.owner, entityId: nullObjectId } }
                await expect(assetsService.finalizeUpload(assetId, other)).rejects.toMatchObject({
                    status: HttpStatus.CONFLICT
                })
                await expect(assetsService.findOwner(assetId)).resolves.toEqual(original.owner)
                await expect(assetsService.isUploadComplete(assetId)).resolves.toBe(true)
            })
        })

        describe('ID에 해당하는 에셋이 없으면', () => {
            let assetId: Parameters<typeof assetsService.finalizeUpload>[0]
            beforeEach(() => {
                assetId = nullObjectId
            })
            it('업로드를 완료 처리하면 404 예외를 던진다', async () => {
                await expect(
                    assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
            })
        })
    })

    describe('일부 ID에 해당하는 파일만 존재하면', () => {
        let asset: AssetDto
        let ids: string[]
        beforeEach(async () => {
            asset = await uploadAndFinalizeAsset(fix, file)
            ids = [asset.id, nullObjectId]
        })
        it('findMany는 존재하는 파일의 다운로드 정보만 반환한다', async () => {
            const found = await assetsService.findMany(ids)
            expect(found).toMatchObject([{ id: asset.id, download: { url: expect.any(String) } }])
            expect(await downloadAsset(ensure(found[0]))).toEqual(await downloadAsset(asset))
        })
    })

    describe('getMany', () => {
        describe('에셋이 존재할 때', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            it('에셋을 조회하면 다운로드 정보를 반환하고 파일의 체크섬을 유지한다', async () => {
                const fetchedAssets = await assetsService.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: {
                                expiresAt: expect.any(Temporal.Instant),
                                url: expect.any(String)
                            }
                        }))
                    )
                )
                const buffer = await downloadAsset(ensure(fetchedAssets[0]))

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        describe('ID에 해당하는 에셋이 없으면', () => {
            let assetIds: Parameters<typeof assetsService.getMany>[0]
            beforeEach(() => {
                assetIds = [nullObjectId]
            })
            it('에셋을 조회하면 404 예외를 던진다', async () => {
                await expect(assetsService.getMany(assetIds)).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        describe('완료 처리된 에셋 세 개가 존재하면', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file),
                    uploadAndFinalizeAsset(fix, file)
                ])
            })

            it('에셋을 삭제하면 저장 기록과 다운로드 파일이 함께 사라진다', async () => {
                await expect(assetsService.deleteMany(pickIds(assets))).resolves.toBeUndefined()

                for (const asset of assets) {
                    await expect(assetsService.getMany([asset.id])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                    const { download } = asset
                    if (null === download) throw new Error('download must have value')

                    const response = await fetch(download.url)
                    expect(response.status).toBe(404)
                }
            })

            describe('삭제할 에셋 ID에 존재하지 않는 ID가 섞여 있으면', () => {
                let assetIds: Parameters<typeof assetsService.deleteMany>[0]
                beforeEach(() => {
                    assetIds = [ensure(assets[0]).id, nullObjectId]
                })
                it('에셋 삭제를 요청하면 오류 없이 존재하는 에셋을 삭제한다', async () => {
                    const asset = ensure(assets[0])

                    await expect(assetsService.deleteMany(assetIds)).resolves.toBeUndefined()

                    await expect(assetsService.getMany([asset.id])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                })
            })
        })

        describe('삭제할 에셋 ID 목록이 비어 있으면', () => {
            let assetIds: Parameters<typeof assetsService.deleteMany>[0]
            beforeEach(() => {
                assetIds = []
            })
            it('에셋 삭제를 요청하면 오류 없이 완료한다', async () => {
                await expect(assetsService.deleteMany(assetIds)).resolves.toBeUndefined()
            })
        })

        describe('에셋의 S3 객체를 삭제하는 중 오류가 발생하면', () => {
            let asset: AssetDto
            beforeEach(async () => {
                asset = await uploadAndFinalizeAsset(fix, file)
                const s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                vi.spyOn(s3Service, 'deleteObject').mockRejectedValueOnce(new Error('s3 down'))
            })
            it('에셋 삭제를 요청하면 S3 오류를 던지고 기존 파일을 계속 조회해 내려받을 수 있다', async () => {
                await expect(assetsService.deleteMany([asset.id])).rejects.toThrow('s3 down')
                const [remaining] = await assetsService.getMany([asset.id])
                expect(Checksum.fromBuffer(await downloadAsset(ensure(remaining)))).toEqual(
                    file.checksum
                )
            })
        })
    })

    describe('cleanupExpiredUploads', () => {
        let assetId: string

        beforeEach(async () => {
            expect(scheduler.doesExist('cron', 'registration.cleanupExpiredPhotos')).toBe(true)

            const createDto = buildCreateAssetDto(file)
            const createdAsset = await assetsService.create(createDto)
            assetId = createdAsset.assetId
        })

        describe('미완료 에셋의 업로드 기한이 남아 있으면', () => {
            it('만료 정리를 실행해도 에셋을 유지한다', async () => {
                await assetsService.cleanupExpiredUploads()

                await expect(assetsService.getMany([assetId])).resolves.toHaveLength(1)
            })
        })

        describe('미완료 에셋의 업로드 기한이 지났으면', () => {
            beforeEach(async () => {
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })
            it('만료 정리로 에셋을 삭제한다', async () => {
                await assetsService.cleanupExpiredUploads()

                await expect(assetsService.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })

        describe('소유자가 확정된 에셋의 업로드 기한이 지났으면', () => {
            let finalizedAsset: AssetDto
            beforeEach(async () => {
                finalizedAsset = await uploadAndFinalizeAsset(fix, file)
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
            })
            it('만료 정리를 실행해도 에셋을 유지한다', async () => {
                await assetsService.cleanupExpiredUploads()

                await expect(assetsService.getMany([finalizedAsset.id])).resolves.toHaveLength(1)
            })
        })

        describe('S3 업로드 후 완료 처리 전에 기한이 지난 에셋이 존재하면', () => {
            let uploaded: UploadedFile
            let s3Service: S3ObjectService
            beforeEach(async () => {
                uploaded = await uploadFile(fix, file)
                await overrideConfigGetter(fix.module, 'asset', { uploadExpiresInSec: 0 })
                await expect(
                    assetsService.finalizeUpload(uploaded.assetId, buildFinalizeAssetDto())
                ).rejects.toMatchObject({ status: HttpStatus.NOT_FOUND })
                s3Service = fix.module.get<S3ObjectService>(S3ObjectService.getName())
                await expect(s3Service.isUploadComplete({ key: uploaded.key })).resolves.toBe(true)
            })
            it('만료 정리로 S3 객체와 DB 기록을 모두 삭제한다', async () => {
                await assetsService.cleanupExpiredUploads()
                await expect(s3Service.isUploadComplete({ key: uploaded.key })).resolves.toBe(false)
                await expect(assetsService.getMany([uploaded.assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })
})
