import { Injectable } from '@nestjs/common'
import { AmazonS3Module, AmazonS3Service, generateShortId, InjectAmazonS3 } from 'common'
import { createTestingModule, getAmazonS3TestConnection } from 'testlib'

@Injectable()
class TestInjectAmazonS3Service {
    constructor(@InjectAmazonS3() _: AmazonS3Service) {}
}

export interface Fixture {
    teardown: () => Promise<void>
    s3Service: AmazonS3Service
}

export async function createFixture() {
    const { endpoint, region, accessKeyId, secretAccessKey, forcePathStyle } =
        getAmazonS3TestConnection()

    const module = await createTestingModule({
        imports: [
            AmazonS3Module.register({
                endpoint,
                accessKeyId,
                secretAccessKey,
                region,
                forcePathStyle
            })
        ],
        providers: [TestInjectAmazonS3Service]
    })

    const s3Service = module.get(AmazonS3Service.getServiceName())

    const teardown = async () => {
        await module.close()
    }

    return { teardown, s3Service }
}

export const newBucketName = () => generateShortId().toLowerCase()

export const uploadObject = async (
    s3Service: AmazonS3Service,
    bucket: string,
    key: string,
    body: string
) => {
    const { uploadUrl } = await s3Service.getUploadUrl({ bucket, key, expiresInSec: 60 })

    const res = await fetch(uploadUrl, {
        method: 'PUT',
        headers: [['Content-Type', 'text/plain']],
        body: Buffer.from(body)
    })

    expect(res.ok).toBe(true)
}
