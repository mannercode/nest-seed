import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { generateShortId, InjectS3Object, S3Object, S3ObjectModule, S3ObjectService } from 'common'
import { createTestingModule, getS3TestConnection } from 'testlib'

@Injectable()
class TestInjectS3ObjectService {
    constructor(@InjectS3Object() readonly _: S3ObjectService) {}
}

export type Fixture = { teardown: () => Promise<void>; s3Service: S3ObjectService }

export async function createFixture() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = getS3TestConnection()

    const bucket = await createTempBucket()

    const module = await createTestingModule({
        imports: [
            S3ObjectModule.register({
                useFactory() {
                    return {
                        endpoint,
                        accessKeyId,
                        secretAccessKey,
                        region,
                        bucket,
                        forcePathStyle
                    }
                }
            })
        ],
        providers: [TestInjectS3ObjectService]
    })

    const s3Service = module.get(S3ObjectService.getServiceName())

    async function teardown() {
        await module.close()
    }

    return { teardown, s3Service }
}

async function createTempBucket() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } = getS3TestConnection()

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

export async function uploadObject(s3Service: S3ObjectService, key: string, body: string) {
    const uploadUrl = await s3Service.presignUploadUrl({ key, expiresInSec: 60 })

    const uploadResponse = await fetch(uploadUrl, { method: 'PUT', body: Buffer.from(body) })

    expect(uploadResponse.ok).toBe(true)
}

export const testBuffer = Buffer.alloc(
    10 * 1024 * 1024,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하~!@#$%^&*()_+'
)

export type PutObjectResult = { key: string } & S3Object
export async function putObject(storageService: S3ObjectService, data: Buffer) {
    const filename = 'file.txt'
    const contentType = 'text/plain'
    const { key } = await storageService.putObject({ data, filename, contentType })

    return { key, data, filename, contentType }
}
