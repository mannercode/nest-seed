import { readFile } from 'fs/promises'
import { TestContext } from 'testlib'
import { FixtureFile } from '../fixture-files'

export async function getAssets({ module }: TestContext, assetIds: string[]) {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsService = module.get(AssetsClient)

    return assetsService.getMany(assetIds)
}

export async function uploadAssets({ module }: TestContext, files: FixtureFile[]) {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsService = module.get(AssetsClient)

    const assetIds: string[] = []

    for (const file of files) {
        const { assetId, uploadRequest: upload } = await assetsService.create({
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            checksum: file.checksum
        })

        const uploadRes = await fetch(upload.url, {
            method: upload.method,
            headers: upload.headers,
            body: await readFile(file.path)
        })

        if (!uploadRes.ok) {
            throw new Error(`Failed to upload asset ${assetId}`)
        }

        assetIds.push(assetId)
    }

    return assetsService.getMany(assetIds)
}
