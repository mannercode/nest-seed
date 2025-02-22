import { CloseFixture, HttpTestClient } from 'testlib'

describe('common/http/pipes', () => {
    let closeFixture: CloseFixture
    let client: HttpTestClient

    beforeEach(async () => {
        const { createFixture } = await import('./latlong.pipe.fixture')

        const fixture = await createFixture()
        closeFixture = fixture.closeFixture
        client = fixture.client
    })

    afterEach(async () => {
        await closeFixture?.()
    })

    describe('LatLongPipe', () => {
        it('유효한 위경도를 파싱해야 한다', async () => {
            const res = await client.get('/latlong').query({ location: '37.123,128.678' }).ok()

            expect(res.body).toEqual({ latitude: 37.123, longitude: 128.678 })
        })

        it('latlong 값이 없으면 BadRequestException을 발생시켜야 한다', async () => {
            return client.get('/latlong').badRequest()
        })

        it('잘못된 형식인 경우 BadRequestException을 발생시켜야 한다', async () => {
            return client.get('/latlong').query({ location: '37.123' }).badRequest()
        })

        it('범위를 벗어난 값인 경우 BadRequestException을 발생시켜야 한다', async () => {
            return client.get('/latlong').query({ location: '91,181' }).badRequest()
        })
    })
})
