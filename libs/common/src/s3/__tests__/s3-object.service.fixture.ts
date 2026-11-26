import { createTestContext } from '@mannercode/testing'
import { Injectable } from '@nestjs/common'
import { InjectS3Object, S3ObjectModule, S3ObjectService, type S3ServiceConfig } from '#common/s3'

export type S3ObjectServiceFixture = { s3Service: S3ObjectService; teardown: () => Promise<void> }

@Injectable()
class TestInjectS3ObjectService {
    constructor(@InjectS3Object() readonly _: S3ObjectService) {}
}

export async function createS3ObjectServiceFixture() {
    const config: S3ServiceConfig = {
        ...JSON.parse(process.env.TESTLIB_S3_OPTIONS!),
        bucket: process.env.TESTLIB_S3_BUCKET as string
    }

    const { close, module } = await createTestContext({
        imports: [S3ObjectModule.register({ useFactory: () => config })],
        providers: [TestInjectS3ObjectService]
    })

    const s3Service = module.get(S3ObjectService.getName())

    const teardown = async () => {
        await close()
    }

    return { s3Service, teardown }
}

export async function uploadObject(s3Service: S3ObjectService, key: string, body: string) {
    const { fields, url } = await s3Service.presignUploadPost({ expiresInSec: 60, key })
    const form = new FormData()

    Object.entries(fields).forEach(([fieldKey, value]) => {
        form.append(fieldKey, value)
    })

    const blob = new Blob([Buffer.from(body)], { type: 'application/octet-stream' })
    form.append('file', blob, 'file')

    const response = await fetch(url, { body: form, method: 'POST' })
    expect(response.ok).toBe(true)
}

export const testBuffer = Buffer.from(Array.from({ length: 256 }, (_, index) => index))
