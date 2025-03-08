import { BadRequestException } from '@nestjs/common'
import { ClientProxyService, CommonErrors } from 'common'
import { HttpTestClient, withTestId } from 'testlib'

describe('HttpExceptionFilter', () => {
    let closeFixture: () => void
    let client: HttpTestClient
    let proxyService: ClientProxyService

    beforeEach(async () => {
        const { createFixture } = await import('./http-exception.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
        proxyService = fixture.proxyService
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('HttpException을 던지면 해당하는 StatusCode를 반환해야 한다', async () => {
        await client.get('/bad-request').badRequest({
            error: 'Bad Request',
            message: 'throwHttpException'
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

    it('RpcController에서 던지는 예외에는 영향이 없어야 한다', async () => {
        const promise = proxyService.getJson(withTestId('subject.throwException'), {})

        await expect(promise).rejects.toEqual(new BadRequestException('throwRpcException'))
    })
})
