import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { MulterConfigModule, StorageFilesController } from 'apps/gateway'
import { StorageFilesClient, StorageFilesModule } from 'apps/infrastructures'
import {
    createConfigServiceMock,
    FixtureFile,
    fixtureFiles,
    TestFixture,
    createTestFixture
} from '../__helpers__'
import { getS3TestConnection, getTestId } from 'testlib'

export interface Fixture extends TestFixture {
    overLimitFiles: FixtureFile[]
    localFiles: {
        notAllowed: FixtureFile
        oversized: FixtureFile
        large: FixtureFile
        small: FixtureFile
    }
}

export const createFixture = async () => {
    const s3 = await createS3Bucket()
    const localFiles = {
        notAllowed: fixtureFiles.json,
        oversized: fixtureFiles.oversized,
        large: fixtureFiles.large,
        small: fixtureFiles.small
    }

    const maxFilesPerUpload = 3

    const configMock = createConfigServiceMock({
        FILE_UPLOAD_MAX_FILE_SIZE_BYTES: localFiles.oversized.size,
        FILE_UPLOAD_MAX_FILES_PER_UPLOAD: maxFilesPerUpload,
        FILE_UPLOAD_ALLOWED_FILE_TYPES: 'text/plain',
        S3_ENDPOINT: s3.endpoint,
        S3_REGION: s3.region,
        S3_BUCKET: s3.bucket,
        S3_ACCESS_KEY_ID: s3.accessKeyId,
        S3_SECRET_ACCESS_KEY: s3.secretAccessKey,
        S3_FORCE_PATH_STYLE: s3.forcePathStyle
    })

    const fix = await createTestFixture({
        imports: [MulterConfigModule, StorageFilesModule],
        providers: [StorageFilesClient],
        controllers: [StorageFilesController],
        overrideProviders: [configMock]
    })

    const overLimitFiles = Array(maxFilesPerUpload + 1).fill(localFiles.small)

    return { ...fix, overLimitFiles, localFiles }
}

const createS3Bucket = async () => {
    const { endpoint, accessKeyId, secretAccessKey, region, forcePathStyle } = getS3TestConnection()

    const bucket = `storage-files-${getTestId()}`.toLowerCase()

    const client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle
    })

    await client.send(new CreateBucketCommand({ Bucket: bucket }))

    return { endpoint, accessKeyId, secretAccessKey, region, bucket, forcePathStyle }
}
