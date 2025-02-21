import { HttpTestClient, TestContext } from 'testlib'

describe('HttpExceptionFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-exception.filter.fixture')

        const fixture = await createFixture()
        testContext = fixture.testContext
        client = fixture.client
    })

    afterEach(async () => {
        await testContext?.close()
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
            code: 'ERR_MAX_COUNT_EXCEED',
            message: 'Too many files'
        })
    })

    it('PayloadTooLargeException("File too large")을 반환해야 한다', async () => {
        await client.get('/file-too-large').payloadTooLarge({
            code: 'ERR_MAX_SIZE_EXCEED',
            message: 'File too large'
        })
    })
})
