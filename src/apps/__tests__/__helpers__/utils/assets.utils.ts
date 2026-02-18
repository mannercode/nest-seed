import type {
    AssetDto,
    AssetPresignedUploadDto,
    CreateAssetDto,
    FinalizeAssetDto
} from 'apps/infrastructures'
import type { TestContext } from 'testlib'
import { readFile } from 'fs/promises'
import { pick } from 'lodash'
import { basename } from 'path'
import type { TestAsset } from '../assets'
import { testAssets } from '../assets'

export function buildCreateAssetDto(file: TestAsset = testAssets.image): CreateAssetDto {
    return pick(file, ['originalName', 'mimeType', 'size', 'checksum'])
}

export function buildFinalizeAssetDto(overrides = {}) {
    return {
        owner: { entityId: 'entity-id', service: 'service', ...overrides }
    } as FinalizeAssetDto
}

export async function createAsset(ctx: TestContext, file: TestAsset = testAssets.image) {
    const { AssetsService } = await import('apps/infrastructures')
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

    const { AssetsService } = await import('apps/infrastructures')
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
    expect(uploadRes.ok).toBe(true)

    return uploadRequest.assetId
}
