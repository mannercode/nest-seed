import { HttpTestClient, HttpTestContext, createHttpTestContext } from 'testlib'
import { TestModule } from './latlong.pipe.fixture'

describe('common/http/pipes', () => {
    let testContext: HttpTestContext
    let client: HttpTestClient

    beforeEach(async () => {
        testContext = await createHttpTestContext({ imports: [TestModule] })
        client = testContext.client
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
