import { Logger } from '@nestjs/common'
import express from 'express'
import { HttpTestClient, TestContext, createTestContext } from 'testlib'
import { TestModule } from './http-exception.filter.fixture'

describe('HttpExceptionFilter', () => {
    let testContext: TestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        spy = jest.spyOn(Logger, 'warn').mockImplementation(() => {})

        testContext = await createTestContext({
            metadata: { imports: [TestModule] },
            configureApp: async (app) => {
                app.use(express.urlencoded({ extended: true }))
            }
        })

        client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)
    })

    afterEach(async () => {
        await testContext?.close()
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
