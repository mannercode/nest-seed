import { createReadStream } from 'fs'
import { pick } from 'lodash'
import { TestContext } from 'testlib'
import { FixtureFile } from '../fixture-files'

export async function uploadAndCompleteAsset({ module }: TestContext, file: FixtureFile) {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsClient = module.get(AssetsClient)

    const createDto = pick(file, ['originalName', 'mimeType', 'size', 'checksum'])

    const uploadRequest = await assetsClient.create(createDto)
    const { url, method, headers } = uploadRequest

    const stream = createReadStream(file.path)
    const uploadRes = await fetch(url, { method, headers, body: stream, duplex: 'half' })
    expect(uploadRes.ok).toBe(true)

    const owner = { ownerService: 'service-name', ownerEntityId: 'entity-id' }
    const completedAsset = await assetsClient.complete(uploadRequest.assetId, owner)

    return completedAsset
}
