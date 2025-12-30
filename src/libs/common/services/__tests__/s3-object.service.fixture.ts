import { Injectable } from '@nestjs/common'
import { InjectS3Object, S3ObjectModule, S3ObjectService } from 'common'
import { createTestContext, getS3TestConnection } from 'testlib'

@Injectable()
class TestInjectS3ObjectService {
    constructor(@InjectS3Object() readonly _: S3ObjectService) {}
}

export type S3ObjectServiceFixture = { teardown: () => Promise<void>; s3Service: S3ObjectService }

export async function createS3ObjectServiceFixture() {
    const { endpoint, accessKeyId, secretAccessKey, region, forcePathStyle, bucket } =
        getS3TestConnection()

    const { module, close } = await createTestContext({
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

    const s3Service = module.get(S3ObjectService.getName())

    const teardown = async () => {
        await close()
    }

    return { teardown, s3Service }
}

export async function uploadObject(s3Service: S3ObjectService, key: string, body: string) {
    const uploadUrl = await s3Service.presignUploadUrl({ key, expiresInSec: 60 })

    const response = await fetch(uploadUrl, { method: 'PUT', body: Buffer.from(body) })
    expect(response.ok).toBe(true)
}

export const testBuffer = Buffer.alloc(
    10 * 1024 * 1024,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하~!@#$%^&*()_+'
)
