import { Logger } from '@nestjs/common'
import express from 'express'
import { HttpTestClient, TestContext, createTestContext } from 'testlib'
import { TestModule } from './http-success.interceptor.fixture'

describe('HttpSuccessInterceptor', () => {
    let testContext: TestContext
    let client: HttpTestClient
    let spy: jest.SpyInstance

    beforeEach(async () => {
        spy = jest.spyOn(Logger, 'verbose').mockImplementation(() => {})

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
