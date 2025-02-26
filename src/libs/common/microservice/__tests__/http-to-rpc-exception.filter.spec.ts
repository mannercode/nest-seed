import { CloseFixture, MicroserviceTestClient, withTestId } from 'testlib'

describe('HttpToRpcExceptionFilter', () => {
    let closeFixture: CloseFixture
    let client: MicroserviceTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./http-to-rpc-exception.filter.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    it('RPC에 대해 HttpException을 올바르게 처리해야 한다', async () => {
        await client.error(
            withTestId('subject.throwHttpException'),
            {},
            {
                response: { error: 'Not Found', message: 'not found exception', statusCode: 404 },
                status: 404
            }
        )
    })

    it('RPC에 대해 {status, response}를 올바르게 처리해야 한다', async () => {
        await client.error(
            withTestId('subject.rethrow'),
            {},
            { status: 400, response: { message: 'error message' } }
        )
    })

    it('RPC에 대해 Error를 올바르게 처리해야 한다', async () => {
        await client.error(withTestId('subject.throwError'), {}, { status: 500 })
    })

    it('메시지 없는 예외 객체를 올바르게 처리해야 함', async () => {
        await client.error(
            withTestId('subject.throwObjectWithoutMessage'),
            {},
            { status: 500, message: 'Internal server error' }
        )
    })

    it('잘못된 데이터 형식에 대해 입력을 검증하고 오류를 반환해야 한다', async () => {
        await client.error(
            withTestId('subject.createSample'),
            { wrong: 'wrong field' },
            {
                response: {
                    error: 'Bad Request',
                    message: ['name should not be empty', 'name must be a string'],
                    statusCode: 400
                },
                status: 400
            }
        )
    })
})
