import { CommonErrors } from 'common'
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
            message: 'http-exception'
        })
    })

    it('Error를 던지면 INTERNAL_SERVER_ERROR(500)를 반환해야 한다', async () => {
        await client.get('/error').internalServerError({
            error: 'Internal server error',
            message: 'test'
        })
    })

    it('BadRequestException("Too many files")을 반환해야 한다', async () => {
        await client.get('/too-many-files').badRequest(CommonErrors.FileUpload.MaxCountExceeded)
    })

    it('PayloadTooLargeException("File too large")을 반환해야 한다', async () => {
        await client.get('/file-too-large').payloadTooLarge(CommonErrors.FileUpload.MaxSizeExceeded)
    })
})
