import { Injectable } from '@nestjs/common'
import { InjectS3Object, S3ObjectModule, S3ObjectService } from 'common'
import { createTestContext, getS3TestConnection } from 'testlib'

@Injectable()
class TestInjectS3ObjectService {
    constructor(@InjectS3Object() readonly _: S3ObjectService) {}
}

export type S3ObjectServiceFixture = { teardown: () => Promise<void>; s3Service: S3ObjectService }

export async function createS3ObjectServiceFixture() {
    const config = getS3TestConnection()

    const { module, close } = await createTestContext({
        imports: [S3ObjectModule.register({ useFactory: () => config })],
        providers: [TestInjectS3ObjectService]
    })

    const s3Service = module.get(S3ObjectService.getName())

    const teardown = async () => {
        await close()
    }

    return { teardown, s3Service }
}

export async function uploadObject(s3Service: S3ObjectService, key: string, body: string) {
    const { url, fields } = await s3Service.presignUploadPost({ key, expiresInSec: 60 })
    const form = new FormData()

    Object.entries(fields).forEach(([fieldKey, value]) => {
        form.append(fieldKey, value)
    })

    const blob = new Blob([Buffer.from(body)], { type: 'application/octet-stream' })
    form.append('file', blob, 'file')

    const response = await fetch(url, { method: 'POST', body: form })
    expect(response.ok).toBe(true)
}

export const testBuffer = Buffer.alloc(
    10 * 1024 * 1024,
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하~!@#$%^&*()_+'
)
