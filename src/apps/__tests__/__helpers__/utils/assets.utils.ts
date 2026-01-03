import { readFile } from 'fs/promises'
import { basename } from 'path'
import { pick } from 'lodash'
import { fixtureFiles, type FixtureFile } from '../fixture-files'
import type {
    AssetDto,
    CompleteAssetDto,
    CreateAssetDto,
    AssetPresignedUploadDto
} from 'apps/infrastructures'
import type { TestContext } from 'testlib'

export function buildCreateAssetDto(file: FixtureFile = fixtureFiles.image): CreateAssetDto {
    return pick(file, ['originalName', 'mimeType', 'size', 'checksum'])
}

export async function createAsset(ctx: TestContext, file: FixtureFile = fixtureFiles.image) {
    const { AssetsService } = await import('apps/infrastructures')
    const assetsService = ctx.module.get(AssetsService)

    const createDto = buildCreateAssetDto(file)
    return assetsService.create(createDto)
}

export async function uploadAsset(filepath: string, uploadDto: AssetPresignedUploadDto) {
    const { url, method, fields } = uploadDto
    const buffer = await readFile(filepath)
    const form = new FormData()

    Object.entries(fields).forEach(([fieldKey, value]) => {
        form.append(fieldKey, value)
    })

    const contentType = fields['Content-Type'] ?? 'application/octet-stream'
    const file = new Blob([buffer], { type: contentType })
    form.append('file', file, basename(filepath))

    const response = await fetch(url, { method, body: form })
    return response
}

export async function uploadFile(ctx: TestContext, file: FixtureFile) {
    const uploadRequest = await createAsset(ctx, file)
    const uploadRes = await uploadAsset(file.path, uploadRequest)
    expect(uploadRes.ok).toBe(true)

    return uploadRequest.assetId
}

export function buildCompleteAssetDto(overrides = {}) {
    return {
        owner: { service: 'service', entityId: 'entity-id', ...overrides }
    } as CompleteAssetDto
}

export async function uploadComplete(ctx: TestContext, file: FixtureFile) {
    const assetId = await uploadFile(ctx, file)

    const { AssetsService } = await import('apps/infrastructures')
    const assetsService = ctx.module.get(AssetsService)

    return assetsService.complete(assetId, buildCompleteAssetDto())
}

export async function downloadAsset({ download }: AssetDto) {
    if (null === download) throw new Error('download must have value')

    const res = await fetch(download.url)

    if (!res.ok) {
        throw new Error(`Failed to download asset: ${res.status} ${res.statusText}`)
    }

    const arrayBuffer = await res.arrayBuffer()
    return Buffer.from(arrayBuffer)
}
