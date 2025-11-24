import { LatLong } from 'common'
import type { Fixture } from './lat-long.fixture'

describe('LatLong', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./lat-long.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('distanceInMeters', () => {
        // 두 지점 간 거리를 계산하는 경우
        describe('when calculating distance between two coordinates', () => {
            // 미터 단위 거리를 반환한다
            it('returns the distance in meters', () => {
                const seoul: LatLong = { latitude: 37.5665, longitude: 126.978 }
                const busan: LatLong = { latitude: 35.1796, longitude: 129.0756 }

                const actualDistance = LatLong.distanceInMeters(seoul, busan)

                const expectedDistance = 325000
                const tolerance = 0.05 * expectedDistance // 5% 오차 범위

                expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
                expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
            })
        })
    })

    describe('GET /latLong', () => {
        // 유효한 쿼리인 경우
        describe('when the query is valid', () => {
            // 위경도를 반환한다
            it('returns the latitude and longitude', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123,128.678' })
                    .ok({ latitude: 37.123, longitude: 128.678 })
            })
        })

        // latLong 값이 없는 경우
        describe('when the latLong value is missing', () => {
            // BadRequestException을 던진다
            it('throws BadRequestException', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .badRequest({
                        code: 'ERR_LATLONG_REQUIRED',
                        message: 'The latLong query parameter is required'
                    })
            })
        })

        // 형식이 잘못된 경우
        describe('when the latLong format is invalid', () => {
            // BadRequestException을 던진다
            it('throws BadRequestException', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123' })
                    .badRequest({
                        code: 'ERR_LATLONG_FORMAT_INVALID',
                        message: 'LatLong should be in the format "latitude,longitude"'
                    })
            })
        })

        // 범위를 벗어난 경우
        describe('when values are out of range', () => {
            // BadRequestException을 던진다
            it('throws BadRequestException', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '91,181' })
                    .badRequest({
                        code: 'ERR_LATLONG_VALIDATION_FAILED',
                        details: [
                            {
                                constraints: { max: 'latitude must not be greater than 90' },
                                field: 'latitude'
                            },
                            {
                                constraints: { max: 'longitude must not be greater than 180' },
                                field: 'longitude'
                            }
                        ],
                        message: 'LatLong validation failed'
                    })
            })
        })
    })
})
