import { Logger } from '@nestjs/common'
import { HttpTestClient, TestContext, createHttpTestContext } from 'testlib'
import { TestModule } from './http-error.filter.fixture'

describe('ErrorFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        spy = jest.spyOn(Logger, 'error').mockImplementation(() => {})

        testContext = await createHttpTestContext({ imports: [TestModule] })

        client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)
    })

    afterEach(async () => {
        await testContext?.close()
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
                body: undefined,
                stack: expect.any(String)
            })
        )
    })
})
