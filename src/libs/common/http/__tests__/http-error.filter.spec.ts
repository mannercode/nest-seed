import { Logger } from '@nestjs/common'
import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { TestModule } from './http-error.filter.fixture'

describe('ErrorFilter', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [TestModule] })
        client = testContext.client
        spy = jest.spyOn(Logger, 'error').mockImplementation(() => {})
    })

    afterEach(async () => {
        await testContext?.close()
        jest.restoreAllMocks()
    })

    it('should call Logger.error() when an error occurs', async () => {
        await client.get('/').internalServerError()

        expect(spy).toHaveBeenCalledTimes(1)
        expect(spy).toHaveBeenCalledWith(
            'test',
            'HTTP',
            expect.objectContaining({
                statusCode: 500,
                method: 'GET',
                url: '/',
                body: {},
                stack: expect.any(String)
            })
        )
    })
})
