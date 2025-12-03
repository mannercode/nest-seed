import { CreateBucketCommand, S3Client } from '@aws-sdk/client-s3'
import { Injectable } from '@nestjs/common'
import { generateShortId, InjectS3Object, S3Object, S3ObjectModule, S3ObjectService } from 'common'
import { createTestingModule } from 'testlib'

@Injectable()
class TestInjectS3ObjectService {
    constructor(@InjectS3Object() readonly _: S3ObjectService) {}
}

export type S3ObjectServiceFixture = { teardown: () => Promise<void>; s3Service: S3ObjectService }

export async function createS3ObjectServiceFixture() {
    const endpoint = process.env.MINIO_ENDPOINT!
    const accessKeyId = process.env.MINIO_ACCESS_KEY!
    const secretAccessKey = process.env.MINIO_SECRET_KEY!
    const region = 'us-east-1'
    const forcePathStyle = true

    const bucket = await createTempBucket(endpoint, accessKeyId, secretAccessKey, region)

    const module = await createTestingModule({
        imports: [
            S3ObjectModule.register({
                useFactory() {
                    return {
                        endpoint,
                        accessKeyId,
                        secretAccessKey,
                        region,
                        forcePathStyle,
                        bucket
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

async function createTempBucket(
    endpoint: string,
    accessKeyId: string,
    secretAccessKey: string,
    region: string
) {
    const client = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true
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
