import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { readFile } from 'fs/promises'
import { TestContext, getS3TestConnection } from 'testlib'
import { FixtureFile } from '../fixture-files'

export const getAssets = async ({ module }: TestContext, assetIds: string[]) => {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsService = module.get(AssetsClient)

    return assetsService.getMany(assetIds)
}

export const uploadAssets = async ({ module }: TestContext, files: FixtureFile[]) => {
    const { AssetsClient } = await import('apps/infrastructures')
    const assetsService = module.get(AssetsClient)

    await ensureS3Bucket()

    const assetIds: string[] = []

    for (const file of files) {
        const { assetId, uploadUrl, method, headers } = await assetsService.create({
            originalName: file.originalName,
            mimeType: file.mimeType,
            size: file.size,
            checksum: file.checksum.value
        })

        const uploadRes = await fetch(uploadUrl, {
            method,
            headers,
            body: await readFile(file.path)
        })

        if (!uploadRes.ok) {
            throw new Error(`Failed to upload asset ${assetId}`)
        }

        assetIds.push(assetId)
    }

    return assetsService.getMany(assetIds)
}

export const ensureS3Bucket = async () => {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle, bucket } =
        getS3TestConnection()

    const client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle
    })

    try {
        await client.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (error: any) {
        if (error?.name !== 'BucketAlreadyOwnedByYou' && error?.$metadata?.httpStatusCode !== 409) {
            throw error
        }
    }
}
