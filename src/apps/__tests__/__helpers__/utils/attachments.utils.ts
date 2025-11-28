import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { readFile } from 'fs/promises'
import { TestContext, getS3TestConnection } from 'testlib'
import { FixtureFile } from '../fixture-files'

export const getAttachments = async ({ module }: TestContext, fileIds: string[]) => {
    const { AttachmentsClient } = await import('apps/infrastructures')
    const attachmentsService = module.get(AttachmentsClient)

    return attachmentsService.getMany(fileIds)
}

export const uploadAttachments = async ({ module }: TestContext, files: FixtureFile[]) => {
    const { AttachmentsClient } = await import('apps/infrastructures')
    const attachmentsService = module.get(AttachmentsClient)

    await ensureS3Bucket()

    const attachmentIds: string[] = []

    for (const file of files) {
        const { attachmentId, uploadUrl, method, headers } = await attachmentsService.create({
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
            throw new Error(`Failed to upload attachment ${attachmentId}`)
        }

        attachmentIds.push(attachmentId)
    }

    return attachmentsService.getMany(attachmentIds)
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
