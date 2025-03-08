import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { ClientProxyService } from 'common'
import { lastValueFrom } from 'rxjs'
import { CloseFixture, HttpTestClient, withTestId } from 'testlib'

describe('HttpToRpcExceptionFilter', () => {
    let closeFixture: CloseFixture
    let httpClient: HttpTestClient
    let proxyService: ClientProxyService

    beforeEach(async () => {
        const { createFixture } = await import('./rpc-exception.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        httpClient = fixture.httpClient
        proxyService = fixture.proxyService
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('RpcController에서 던지는 HttpException이 복원되어야 한다', async () => {
        const promise = proxyService.getJson(withTestId('subject.throwHttpException'), {})

        await expect(promise).rejects.toEqual(new NotFoundException('not found exception'))
    })

    it('RpcController에서 던지는 Error가 복원되어야 한다', async () => {
        const promise = proxyService.getJson(withTestId('subject.throwError'), {})

        await expect(promise).rejects.toEqual(new InternalServerErrorException('error message'))
    })

    it('HttpController에서 던지는 예외에는 영향이 없어야 한다', async () => {
        await httpClient
            .get('/throwHttpException')
            .notFound({ error: 'Not Found', message: 'not found exception' })
    })

    it('잘못된 데이터 형식에 대해 입력을 검증하고 오류를 반환해야 한다', async () => {
        const promise = lastValueFrom(
            proxyService.send(withTestId('subject.verifyDto'), { wrong: 'wrong field' })
        )

        await expect(promise).rejects.toEqual({
            error: 'Bad Request',
            message: ['name should not be empty', 'name must be a string'],
            statusCode: 400
        })
    })
})
