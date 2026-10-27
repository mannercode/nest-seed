import type { TestContext } from '@mannercode/testing'
import { pick, S3ObjectService } from '@mannercode/common'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import {
    type AssetDto,
    type AssetPresignedUploadDto,
    type CreateAssetDto,
    type FinalizeAssetDto,
    AssetsService
} from '#infrastructure'
import { testAssets, type TestAsset } from '../assets/index.js'
import { AssetsRepository } from '../../../services/infrastructure/assets/assets.repository.js'

export function buildCreateAssetDto(file: TestAsset = testAssets.image): CreateAssetDto {
    return pick(file, ['originalName', 'mimeType', 'size', 'checksum'])
}

export function buildFinalizeAssetDto(
    ownerOverrides: Partial<FinalizeAssetDto['owner']> = {}
): FinalizeAssetDto {
    return { owner: { entityId: 'entity-id', service: 'service', ...ownerOverrides } }
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
    const assetId = await uploadFile(ctx, file)

    const assetsService = ctx.module.get(AssetsService)

    return assetsService.finalizeUpload(assetId, buildFinalizeAssetDto())
}

export async function uploadAsset(filePath: string, uploadDto: AssetPresignedUploadDto) {
    const { fields, method, url } = uploadDto
    const buffer = await readFile(filePath)
    const form = new FormData()

    Object.entries(fields).forEach(([fieldKey, value]) => {
        form.append(fieldKey, value)
    })

    const contentType = fields['Content-Type'] ?? 'application/octet-stream'
    const file = new Blob([buffer], { type: contentType })
    form.append('file', file, basename(filePath))

    const response = await fetch(url, { body: form, method })
    return response
}

export async function uploadFile(ctx: TestContext, file: TestAsset) {
    const uploadRequest = await createAsset(ctx, file)
    const uploadRes = await uploadAsset(file.path, uploadRequest)
    expect(uploadRes.ok, `S3 upload failed (${uploadRes.status}): ${await uploadRes.text()}`).toBe(
        true
    )

    return uploadRequest.assetId
}

export function pauseNextAssetOwnerAssignment(ctx: TestContext) {
    const repository = ctx.module.get(AssetsRepository)
    const assignOwner = repository.assignOwner.bind(repository)
    const started = Promise.withResolvers<void>()
    const held = Promise.withResolvers<void>()
    vi.spyOn(repository, 'assignOwner').mockImplementationOnce(async (...args) => {
        started.resolve()
        await held.promise
        return assignOwner(...args)
    })
    return { started: started.promise, release: held.resolve }
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
