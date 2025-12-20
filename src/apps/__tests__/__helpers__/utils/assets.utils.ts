import { createReadStream } from 'fs'
import type { FixtureFile } from '../fixture-files'
import type {
    AssetDto,
    CompleteAssetDto,
    CreateAssetDto,
    AssetPresignedUploadDto
} from 'apps/infrastructures'
import type { TestContext } from 'testlib'

export function buildCreateAssetDto(file: FixtureFile, overrides = {}) {
    const { originalName, mimeType, size, checksum } = file

    return { originalName, mimeType, size, checksum, ...overrides } as CreateAssetDto
}

export function buildCompleteAssetDto(overrides = {}) {
    return {
        owner: { service: 'service', entityId: 'entity-id', ...overrides }
    } as CompleteAssetDto
}

export async function uploadAsset(filepath: string, uploadDto: AssetPresignedUploadDto) {
    const { url, method, headers } = uploadDto
    const stream = createReadStream(filepath)

    const response = await fetch(url, { method, headers, body: stream, duplex: 'half' })
    return response
}

export async function uploadFile(ctx: TestContext, file: FixtureFile) {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsClient = ctx.module.get(AssetsClient)

    const createDto = buildCreateAssetDto(file)
    const uploadRequest = await assetsClient.create(createDto)

    const uploadRes = await uploadAsset(file.path, uploadRequest)
    expect(uploadRes.ok).toBe(true)

    return uploadRequest.assetId
}

export async function uploadComplete(ctx: TestContext, file: FixtureFile) {
    const assetId = await uploadFile(ctx, file)

    const { AssetsClient } = await import('apps/infrastructures')
    const assetsClient = ctx.module.get(AssetsClient)

    return assetsClient.complete(assetId, buildCompleteAssetDto())
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
