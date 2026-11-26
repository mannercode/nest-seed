import type { AppTestContext } from '#test-helpers'
import type { TestContext } from '@mannercode/testing'
import { DateUtil, ensure, pick, S3ObjectService } from '@mannercode/common'
import { readFile } from 'fs/promises'
import { Collection } from 'mongodb'
import { basename } from 'path'
import { AppConfigService } from '#config'
import {
    type AssetDto,
    type AssetPresignedUploadDto,
    AssetPresignedUploadSchema,
    type CreateAssetDto,
    type FinalizeAssetDto,
    AssetsService
} from '#infrastructure'
import { testAssets, type TestAsset } from '../assets/index.js'

export function buildCreateAssetDto(file: TestAsset = testAssets.image): CreateAssetDto {
    return pick(file, ['originalName', 'mimeType', 'size', 'checksum'])
}

export async function requestRegistrationPhotoUpload(
    ctx: AppTestContext,
    metadata: CreateAssetDto = buildCreateAssetDto()
) {
    const { body } = await ctx.httpClient
        .post('/users/photo-upload')
        .body(metadata)
        .created({ schema: AssetPresignedUploadSchema })
    return body
}

export function buildFinalizeAssetDto(
    ownerOverrides: Partial<FinalizeAssetDto['owner']> = {}
): FinalizeAssetDto {
    return { owner: { entityId: 'entity-id', service: 'service', ...ownerOverrides } }
}

export function advancePastUploadDeadline(ctx: TestContext) {
    const { uploadExpiresInSec } = ctx.module.get(AppConfigService).asset
    const now = DateUtil.add({ seconds: uploadExpiresInSec })
    vi.spyOn(DateUtil, 'now').mockReturnValue(now)
}

export async function createAsset(ctx: TestContext, file: TestAsset = testAssets.image) {
    const assetsService = ctx.module.get(AssetsService)

    const createDto = buildCreateAssetDto(file)
    return assetsService.create(createDto)
}

export async function downloadAsset({ download }: AssetDto) {
    if (null === download) throw new Error('download must have value')

    const downloadResponse = await fetch(download.url)

    if (!downloadResponse.ok) {
        throw new Error(
            `Failed to download asset: ${downloadResponse.status} ${downloadResponse.statusText}`
        )
    }

    const arrayBuffer = await downloadResponse.arrayBuffer()
    return Buffer.from(arrayBuffer)
}

export async function uploadAndFinalizeAsset(ctx: TestContext, file: TestAsset) {
    const { assetId } = await uploadFile(ctx, file)

    const assetsService = ctx.module.get(AssetsService)

    await assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
    return ensure((await assetsService.getMany([assetId]))[0])
}

export async function uploadAsset(source: string | File, uploadDto: AssetPresignedUploadDto) {
    const { fields, method, url } = uploadDto
    const form = new FormData()

    Object.entries(fields).forEach(([fieldKey, value]) => {
        form.append(fieldKey, value)
    })

    const file =
        typeof source === 'string'
            ? new File([await readFile(source)], basename(source), {
                  type: fields['Content-Type'] ?? 'application/octet-stream'
              })
            : source
    form.append('file', file)

    const response = await fetch(url, { body: form, method })
    return response
}

export async function uploadFile(ctx: TestContext, file: TestAsset) {
    const uploadRequest = await createAsset(ctx, file)
    const uploadRes = await uploadAsset(file.path, uploadRequest)
    expect(uploadRes.ok, `S3 upload failed (${uploadRes.status}): ${await uploadRes.text()}`).toBe(
        true
    )

    return { assetId: uploadRequest.assetId, key: ensure(uploadRequest.fields.key) }
}

export function pauseNextMongoFindOneAndUpdate() {
    const findOneAndUpdate = Collection.prototype.findOneAndUpdate
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    vi.spyOn(Collection.prototype, 'findOneAndUpdate').mockImplementationOnce(async function (
        this: Collection,
        ...args
    ) {
        started.resolve()
        await held.promise
        return findOneAndUpdate.call(this, ...args)
    })
    return { started: started.promise, release: held.resolve }
}

export function failNextMongoUpdateAfterStorageDelete(ctx: TestContext) {
    const storage = ctx.module.get<S3ObjectService>(S3ObjectService.getName())
    const deleteObject = storage.deleteObject.bind(storage)
    const failure = new Error('asset DB update failed')
    vi.spyOn(storage, 'deleteObject').mockImplementationOnce(async (key) => {
        const result = await deleteObject(key)
        vi.spyOn(Collection.prototype, 'updateMany').mockRejectedValueOnce(failure)
        return result
    })
    return failure
}

export function pauseNextStorageDelete(ctx: TestContext) {
    const storage = ctx.module.get<S3ObjectService>(S3ObjectService.getName())
    const deleteObject = storage.deleteObject.bind(storage)
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    vi.spyOn(storage, 'deleteObject').mockImplementationOnce(async (...args) => {
        started.resolve()
        await held.promise
        return deleteObject(...args)
    })
    return { started: started.promise, release: held.resolve }
}
