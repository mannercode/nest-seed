import { InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { getProxyValue } from 'common'
import { CloseFixture, HttpTestClient, MicroserviceTestClient, withTestId } from 'testlib'

describe('HttpToRpcExceptionFilter', () => {
    let closeFixture: CloseFixture
    let client: MicroserviceTestClient
    let httpClient: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./rpc-exception.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
        httpClient = fixture.httpClient
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('RpcController에서 던지는 HttpException이 복원되어야 한다', async () => {
        const promise = getProxyValue(
            client.proxy.send(withTestId('subject.throwHttpException'), {})
        )

        await expect(promise).rejects.toEqual(new NotFoundException('not found exception'))
    })

    it('RpcController에서 던지는 Error가 복원되어야 한다', async () => {
        const promise = getProxyValue(client.proxy.send(withTestId('subject.throwError'), {}))

        await expect(promise).rejects.toEqual(new InternalServerErrorException('error message'))
    })

    it('HttpController에서 던지는 예외에는 영향이 없어야 한다', async () => {
        await httpClient
            .get('/throwHttpException')
            .notFound({ error: 'Not Found', message: 'not found exception' })
    })

    it('잘못된 데이터 형식에 대해 입력을 검증하고 오류를 반환해야 한다', async () => {
        await client.error(
            withTestId('subject.verifyDto'),
            { wrong: 'wrong field' },
            {
                error: 'Bad Request',
                message: ['name should not be empty', 'name must be a string'],
                statusCode: 400
            }
        )
    })
})
