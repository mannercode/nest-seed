import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { TestContext, getS3TestConnection } from 'testlib'
import { FixtureFile } from '../fixture-files'

export const getAttachments = async ({ module }: TestContext, fileIds: string[]) => {
    const { AttachmentsClient } = await import('apps/infrastructures')
    const attachmentsService = module.get(AttachmentsClient)

    return attachmentsService.getFiles(fileIds)
}

export const uploadAttachments = async ({ module }: TestContext, files: FixtureFile[]) => {
    const { AttachmentsClient } = await import('apps/infrastructures')
    const attachmentsService = module.get(AttachmentsClient)

    const uploadedFiles = await attachmentsService.saveFiles(files)
    return uploadedFiles
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
