import { Logger } from '@nestjs/common'
import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { TestModule } from './http-success.interceptor.fixture'

describe('HttpSuccessInterceptor', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [TestModule] })
        client = testContext.client
        spy = jest.spyOn(Logger, 'verbose').mockImplementation(() => {})
    })

    afterEach(async () => {
        await testContext?.close()
        jest.restoreAllMocks()
    })

    it('should call Logger.verbose() when an success occurs', async () => {
        await client.get('/').ok()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'SUCCESS',
            'HTTP',
            expect.objectContaining({
                statusCode: 200,
                method: 'GET',
                url: '/',
                runningTime: expect.any(String)
            })
        )
    })
})
