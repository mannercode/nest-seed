import { HttpTestClient } from 'testlib'

describe('HttpExceptionFilter', () => {
    let closeFixture: () => void
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-exception.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('HttpException을 던지면 해당하는 StatusCode를 반환해야 한다', async () => {
        await client.get('/bad-request').badRequest({
            error: 'Bad Request',
            message: 'http-exception',
            statusCode: 400
        })
    })

    it('BadRequestException("Too many files")을 반환해야 한다', async () => {
        await client.get('/too-many-files').badRequest({
            code: 'ERR_FILE_UPLOAD_MAX_COUNT_EXCEED',
            message: 'Too many files'
        })
    })

    it('PayloadTooLargeException("File too large")을 반환해야 한다', async () => {
        await client.get('/file-too-large').payloadTooLarge({
            code: 'ERR_FILE_UPLOAD_MAX_SIZE_EXCEED',
            message: 'File too large'
        })
    })
})
