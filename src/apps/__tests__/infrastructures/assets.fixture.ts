import {
    AssetDto,
    AssetsClient,
    AssetsModule,
    CreateAssetDto,
    UploadRequest
} from 'apps/infrastructures'
import { Checksum, ChecksumAlgorithm, Path } from 'common'
import { createReadStream } from 'fs'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'
import { TestContext } from 'testlib'
import { createHash, Hash } from 'crypto'

export type AssetsFixture = TestFixture & {
    assetsClient: AssetsClient
    file: FixtureFile
    tempDir: string
}

export async function createAssetsFixture() {
    const testFixture = await createTestFixture({
        imports: [AssetsModule],
        providers: [AssetsClient]
    })

    const assetsClient = testFixture.module.get(AssetsClient)
    const file = fixtureFiles.small

    const tempDir = await Path.createTempDirectory()

    async function teardown() {
        await testFixture.teardown()
        await Path.delete(tempDir)
    }

    return { ...testFixture, teardown, assetsClient, file, tempDir }
}

export function buildCreateAssetDto(file: FixtureFile, overrides = {}) {
    const { originalName, mimeType, size, checksum } = file

    return { originalName, mimeType, size, checksum, ...overrides } as CreateAssetDto
}

export async function uploadAsset(filepath: string, { url, method, headers }: UploadRequest) {
    const stream = createReadStream(filepath)

    const response = await fetch(url, { method, headers, body: stream, duplex: 'half' })
    return response
}

export async function uploadFile({ module }: TestContext, file: FixtureFile) {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsClient = module.get(AssetsClient)

    const createDto = buildCreateAssetDto(file)
    const uploadRequest = await assetsClient.create(createDto)

    const uploadRes = await uploadAsset(file.path, uploadRequest)
    expect(uploadRes.ok).toBe(true)

    return uploadRequest.assetId
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

export class BufferUtil {
    static getChecksum(buffer: Buffer, algorithm: ChecksumAlgorithm = 'sha256'): Checksum {
        const hash: Hash = createHash(algorithm)
        hash.update(buffer)

        return { algorithm, base64: hash.digest('base64') }
    }
}
