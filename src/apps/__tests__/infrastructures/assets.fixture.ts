import { AssetsClient, AssetsModule, CreateAssetDto } from 'apps/infrastructures'
import { pick } from 'lodash'
import { createTestFixture, FixtureFile, fixtureFiles, TestFixture } from '../__helpers__'
import { TestContext } from 'testlib'
import { readFile } from 'fs/promises'
import { Path } from 'common'

export interface Fixture extends TestFixture {
    file: FixtureFile
    assetsClient: AssetsClient
    createDto: CreateAssetDto
    tempDir: string
}

export const createFixture = async () => {
    const testFixture = await createTestFixture({
        imports: [AssetsModule],
        providers: [AssetsClient]
    })

    const assetsClient = testFixture.module.get(AssetsClient)
    const file = fixtureFiles.small
    const createDto = pick(file, ['originalName', 'mimeType', 'size', 'checksum'])

    const tempDir = await Path.createTempDirectory()

    const teardown = async () => {
        await testFixture.teardown()
        await Path.delete(tempDir)
    }

    return { ...testFixture, teardown, assetsClient, file, createDto, tempDir }
}

export const uploadAndCompleteAsset = async (
    { module }: TestContext,
    file: FixtureFile = fixtureFiles.small
) => {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsClient = module.get(AssetsClient)

    const createDto = pick(file, ['originalName', 'mimeType', 'size', 'checksum'])

    const { assetId, uploadRequest } = await assetsClient.create(createDto)
    const { url, method, headers } = uploadRequest
    const body = await readFile(file.path)

    const uploadRes = await fetch(url, { method, headers, body })
    expect(uploadRes.ok).toBe(true)

    const owner = { ownerService: 'service-name', ownerEntityId: 'entity-id' }
    const completedAsset = await assetsClient.complete(assetId, owner)

    return completedAsset
}
