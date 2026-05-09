import type { LatLongFixture } from './lat-long.fixture'
import { LatLong, LatLongErrors } from '../lat-long'

describe('LatLong', () => {
    let fix: LatLongFixture

    beforeEach(async () => {
        const { createLatLongFixture } = await import('./lat-long.fixture')
        fix = await createLatLongFixture()
    })
    afterEach(() => fix.teardown())

    describe('distanceInMeters', () => {
        describe('두 좌표가 제공될 때', () => {
            let seoul: LatLong
            let busan: LatLong

            beforeEach(() => {
                seoul = { latitude: 37.5665, longitude: 126.978 }
                busan = { latitude: 35.1796, longitude: 129.0756 }
            })

            it('두 좌표 사이 거리를 계산한다', () => {
                const actualDistance = LatLong.distanceInMeters(seoul, busan)

                const expectedDistance = 325000
                const tolerance = 0.05 * expectedDistance // 5% 오차 범위

                expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
                expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
            })
        })
    })

    describe('GET /latLong', () => {
        describe('쿼리가 유효할 때', () => {
            it('위도와 경도를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123,128.678' })
                    .ok({ latitude: 37.123, longitude: 128.678 })
            })
        })

        describe('쿼리가 제공되지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient.get('/latLong').badRequest(LatLongErrors.Required())
            })
        })

        describe('쿼리 형식이 유효하지 않을 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('returns 400 Bad Request when location is passed multiple times', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: ['37.123,128.678', '38.123,129.678'] })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('returns 400 Bad Request when extra coordinates are passed', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123,128.678,999' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('returns 400 Bad Request when non-numeric values are passed', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37abc,127xyz' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('returns 400 Bad Request when a coordinate exceeds 20 digits', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '123456789012345678901,127' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })
        })

        describe('쿼리가 범위를 벗어날 때', () => {
            it('400 Bad Request를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '91,181' })
                    .badRequest(LatLongErrors.OutOfRange(expect.any(Array)))
            })
        })
    })
})
