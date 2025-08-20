import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import {
    FileObject,
    FileStorageModule,
    FileStorageService,
    generateShortId,
    InjectFileStorage
} from 'common'
import { createTestingModule, getAmazonS3TestConnection } from 'testlib'

@Injectable()
class TestInjectFileStorageService {
    constructor(@InjectFileStorage() _: FileStorageService) {}
}

export interface Fixture {
    teardown: () => Promise<void>
    storageService: FileStorageService
}

export async function createFixture() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } =
        getAmazonS3TestConnection()

    const bucket = await createTempBucket()

    const module = await createTestingModule({
        imports: [
            FileStorageModule.register({
                useFactory: () => ({
                    endpoint,
                    accessKeyId,
                    secretAccessKey,
                    region,
                    bucket,
                    forcePathStyle
                })
            })
        ],
        providers: [TestInjectFileStorageService]
    })

    const storageService = module.get(FileStorageService.getServiceName())

    const teardown = async () => {
        await module.close()
    }

    return { teardown, storageService }
}

const createTempBucket = async () => {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } =
        getAmazonS3TestConnection()

    const client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle
    })

    const bucket = generateShortId().toLowerCase()
    const command = new CreateBucketCommand({ Bucket: bucket })
    const { $metadata } = await client.send(command)
    expect($metadata.httpStatusCode).toBe(200)

    return bucket
}

export const testBuffer = Buffer.alloc(
    10 * 1024 * 1024,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하~!@#$%^&*()_+'
)

export type PutFileResult = { fileId: string } & FileObject
export const putFile = async (storageService: FileStorageService, data: Buffer) => {
    const filename = 'file.txt'
    const contentType = 'text/plain'
    const { fileId } = await storageService.putFile({ data, filename, contentType })

    return { fileId, data, filename, contentType }
}
