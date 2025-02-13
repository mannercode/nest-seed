import express from 'express'
import { HttpTestClient, TestContext, createTestContext } from 'testlib'
import { TestModule } from './latlong.pipe.fixture'

describe('common/http/pipes', () => {
    let testContext: TestContext
    let client: HttpTestClient

    beforeEach(async () => {
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

    describe('LatLongPipe', () => {
        it('should parse valid latlong', async () => {
            const res = await client.get('/latlong').query({ location: '37.123,128.678' }).ok()

            expect(res.body).toEqual({ latitude: 37.123, longitude: 128.678 })
        })

        it('should throw BadRequestException when latlong is missing', async () => {
            return client.get('/latlong').badRequest()
        })

        it('should throw BadRequestException for invalid format', async () => {
            return client.get('/latlong').query({ location: '37.123' }).badRequest()
        })

        it('should throw BadRequestException for out of range values', async () => {
            return client.get('/latlong').query({ location: '91,181' }).badRequest()
        })
    })
})
