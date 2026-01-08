import { HttpStatus } from '@nestjs/common'
import { Checksum, pickIds, sleep } from 'common'
import { nullObjectId, toAny } from 'testlib'
import {
    buildCompleteAssetDto,
    buildCreateAssetDto,
    createAsset,
    downloadAsset,
    fixtureFiles,
    uploadAsset,
    uploadComplete,
    uploadFile
} from '../__helpers__'
import { type AssetsFixture } from './assets.fixture'
import type { AssetDto } from 'apps/infrastructures'

describe('AssetsService', () => {
    let fix: AssetsFixture
    const file = fixtureFiles.small

    beforeEach(async () => {
        const { createAssetsFixture } = await import('./assets.fixture')
        fix = await createAssetsFixture()
    })
    afterEach(() => fix.teardown())

    describe('create', () => {
        // DTO가 유효할 때
        describe('when the DTO is valid', () => {
            // 업로드 요청을 반환한다
            it('returns an upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                expect(uploadRequest).toEqual({
                    assetId: expect.any(String),
                    url: expect.any(String),
                    expiresAt: expect.any(Date),
                    method: 'POST',
                    fields: expect.any(Object)
                })

                expect(uploadRequest.fields).toEqual(
                    expect.objectContaining({
                        'Content-Type': createDto.mimeType,
                        key: uploadRequest.assetId
                    })
                )
            })

            // 업로드 요청을 사용해 파일을 업로드한다
            it('uploads the file using the upload request', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(true)
            })
        })

        // 업로드 URL이 만료되었을 때
        describe('when the upload URL has expired', () => {
            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1
            })

            // URL 만료 후 업로드를 거부한다
            it('rejects uploads after the URL expires', async () => {
                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                await sleep(1500)

                const uploadRes = await uploadAsset(file.path, uploadRequest)
                expect(uploadRes.ok).toBe(false)
            })
        })

        // 업로드 URL 생성이 실패할 때
        describe('when presign upload fails', () => {
            // 생성된 에셋을 삭제한다
            it('deletes the created asset', async () => {
                const { AssetsService } = await import('apps/infrastructures')
                const { AssetsRepository } =
                    await import('apps/infrastructures/services/assets/assets.repository')
                const { S3ObjectService } = await import('common')

                const assetsService = fix.module.get(AssetsService)
                const assetsRepository = fix.module.get(AssetsRepository)
                const s3Service = fix.module.get(S3ObjectService.getName())

                const originalCreate = assetsRepository.create.bind(assetsRepository)
                const createSpy = jest.spyOn(assetsRepository, 'create')

                let createdAssetId = ''
                createSpy.mockImplementationOnce(async (dto) => {
                    const asset = await originalCreate(dto)
                    createdAssetId = asset.id
                    return asset
                })

                jest.spyOn(s3Service, 'presignUploadUrl').mockRejectedValueOnce(
                    new Error('presign failed')
                )

                const deleteSpy = jest
                    .spyOn(s3Service, 'deleteObject')
                    .mockResolvedValue({ status: 204, key: 'deleted' })

                const createDto = buildCreateAssetDto(file)

                await expect(assetsService.create(createDto)).rejects.toThrow('presign failed')
                expect(deleteSpy).toHaveBeenCalledTimes(1)
                expect(createdAssetId).not.toEqual('')
            })
        })
    })

    describe('isUploadComplete', () => {
        // 업로드가 완료되었을 때
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            // true를 반환한다
            it('returns true', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(true)
            })
        })

        // 업로드가 완료되지 않았을 때
        describe('when the upload is not completed', () => {
            let assetId: string

            beforeEach(async () => {
                const uploadInfo = await createAsset(fix, file)
                assetId = uploadInfo.assetId
            })

            // false를 반환한다
            it('returns false', async () => {
                const isCompleted = await fix.assetsClient.isUploadComplete(assetId)
                expect(isCompleted).toBe(false)
            })
        })
    })

    describe('complete', () => {
        // 업로드가 완료되었을 때
        describe('when the upload is completed', () => {
            let assetId: string

            beforeEach(async () => {
                assetId = await uploadFile(fix, file)
            })

            // 다운로드 정보가 포함된 에셋을 반환한다
            it('returns the asset with download info', async () => {
                const completeDto = buildCompleteAssetDto()

                const asset = await fix.assetsClient.complete(assetId, completeDto)

                expect(asset).toEqual(
                    expect.objectContaining({
                        ...completeDto,
                        download: { url: expect.any(String), expiresAt: expect.any(Date) }
                    })
                )
            })

            // 체크섬이 일치하는 에셋을 다운로드한다
            it('downloads the asset with matching checksum', async () => {
                const completeDto = buildCompleteAssetDto()
                const asset = await fix.assetsClient.complete(assetId, completeDto)

                const buffer = await downloadAsset(asset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        // 업로드가 만료되었을 때
        describe('when the upload has expired', () => {
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const createDto = buildCreateAssetDto(file)
                const uploadRequest = await fix.assetsClient.create(createDto)

                assetId = uploadRequest.assetId

                await sleep(1500)
            })

            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                const completeDto = buildCompleteAssetDto()
                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toMatchObject(
                    { status: HttpStatus.NOT_FOUND }
                )
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                const completeDto = buildCompleteAssetDto()
                await expect(fix.assetsClient.complete(assetId, completeDto)).rejects.toThrow()

                await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('getMany', () => {
        // 에셋이 존재할 때
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, file),
                    uploadComplete(fix, file),
                    uploadComplete(fix, file)
                ])
            })

            // assetIds에 대한 다운로드 정보가 포함된 에셋을 반환한다
            it('returns assets with download info for the assetIds', async () => {
                const fetchedAssets = await fix.assetsClient.getMany(pickIds(assets))

                expect(fetchedAssets).toEqual(
                    expect.arrayContaining(
                        assets.map((asset) => ({
                            ...asset,
                            download: { url: expect.any(String), expiresAt: expect.any(Date) }
                        }))
                    )
                )
            })

            // 체크섬이 일치하는 에셋을 다운로드한다
            it('downloads the asset with matching checksum', async () => {
                const [fetchedAsset] = await fix.assetsClient.getMany([assets[0].id])

                const buffer = await downloadAsset(fetchedAsset)

                const checksum = Checksum.fromBuffer(buffer)
                expect(file.checksum).toEqual(checksum)
            })
        })

        // assetIds에 존재하지 않는 assetId가 포함될 때
        describe('when the assetIds include a non-existent assetId', () => {
            // 404 Not Found를 던진다
            it('throws 404 Not Found', async () => {
                await expect(fix.assetsClient.getMany([nullObjectId])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })
        })
    })

    describe('deleteMany', () => {
        // assetIds가 비어 있을 때
        describe('when the assetIds are empty', () => {
            // 빈 응답을 반환한다
            it('returns an empty response', async () => {
                const { AssetsService } = await import('apps/infrastructures')
                const assetsService = fix.module.get(AssetsService)

                const response = await assetsService.deleteMany([])
                expect(response).toEqual({})
            })
        })

        // 에셋이 존재할 때
        describe('when the assets exist', () => {
            let assets: AssetDto[]

            beforeEach(async () => {
                assets = await Promise.all([
                    uploadComplete(fix, file),
                    uploadComplete(fix, file),
                    uploadComplete(fix, file)
                ])
            })

            // 빈 응답을 반환한다
            it('returns an empty response', async () => {
                const response = await fix.assetsClient.deleteMany(pickIds(assets))
                expect(response).toEqual({})
            })

            // 삭제가 저장된다
            it('persists the deletion', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                await expect(fix.assetsClient.getMany([assets[0].id])).rejects.toMatchObject({
                    status: HttpStatus.NOT_FOUND
                })
            })

            // 이미지 URL을 무효화한다
            it('invalidates image URL', async () => {
                await fix.assetsClient.deleteMany([assets[0].id])

                const { download } = assets[0]
                const response = await fetch(download ? download.url : '')
                expect(response.status).toBe(404)
            })
        })

        // assetIds에 존재하지 않는 assetId가 포함될 때
        describe('when the assetIds include a non-existent assetId', () => {
            // 빈 응답을 반환한다
            it('returns an empty response', async () => {
                const response = await fix.assetsClient.deleteMany([nullObjectId])
                expect(response).toEqual({})
            })
        })

        // 삭제가 실패할 때
        describe('when deletion fails', () => {
            // 500 Internal Server Error를 던진다
            it('throws 500 Internal Server Error', async () => {
                const { AssetsService } = await import('apps/infrastructures')
                const { S3ObjectService } = await import('common')

                const assetsService = fix.module.get(AssetsService)
                const s3Service = fix.module.get(S3ObjectService.getName())

                jest.spyOn(s3Service, 'deleteObject').mockRejectedValue(new Error('delete failed'))

                try {
                    await assetsService.deleteMany([nullObjectId, nullObjectId])
                } catch (error) {
                    expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
                }
            })
        })
    })

    describe('cleanupExpiredUploadsJob', () => {
        // 업로드된 에셋이 존재할 때
        describe('when an uploaded asset exists', () => {
            let fireOnTick: () => Promise<void>
            let assetId: string

            beforeEach(async () => {
                const { Rules } = await import('shared')
                toAny(Rules).Asset.uploadExpiresInSec = 1

                const cronjob = fix.scheduler.getCronJob('assets.cleanupExpiredUploads')
                fireOnTick = cronjob.fireOnTick

                const createDto = buildCreateAssetDto(file)
                const uploadDto = await fix.assetsClient.create(createDto)
                assetId = uploadDto.assetId
            })

            // 업로드가 만료되지 않았을 때
            describe('when the upload has not expired', () => {
                beforeEach(async () => {
                    await fireOnTick()
                    await sleep(1000)
                })

                // 에셋을 유지한다
                it('keeps the asset', async () => {
                    await expect(fix.assetsClient.getMany([assetId])).resolves.toHaveLength(1)
                })
            })

            // 업로드가 만료되었을 때
            describe('when the upload has expired', () => {
                beforeEach(async () => {
                    const { Rules } = await import('shared')
                    await sleep(Rules.Asset.uploadExpiresInSec * 1000 + 500)

                    await fireOnTick()
                    await sleep(1000)
                })

                // 에셋을 제거한다
                it('removes the asset', async () => {
                    await expect(fix.assetsClient.getMany([assetId])).rejects.toMatchObject({
                        status: HttpStatus.NOT_FOUND
                    })
                })
            })
        })
    })
})
