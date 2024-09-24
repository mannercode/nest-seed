import { Logger } from '@nestjs/common'
import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { TestModule } from './http-exception.filter.fixture'

describe('HttpExceptionFilter', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [TestModule] })
        client = testContext.client
        spy = jest.spyOn(Logger, 'warn').mockImplementation(() => {})
    })

    afterEach(async () => {
        await testContext?.close()
        jest.restoreAllMocks()
    })

    it('should call Logger.warn() when an HttpException occurs', async () => {
        await client.get('/').badRequest()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'http-exception',
            'HTTP',
            expect.objectContaining({
                request: { body: {}, method: 'GET', url: '/' },
                response: { error: 'Bad Request', message: 'http-exception', statusCode: 400 },
                stack: expect.any(String)
            })
        )
    })
})
