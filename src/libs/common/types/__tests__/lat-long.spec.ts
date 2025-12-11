import { LatLong } from 'common'
import type { LatLongFixture } from './lat-long.fixture'

describe('LatLong', () => {
    let fixture: LatLongFixture

    beforeEach(async () => {
        const { createLatLongFixture } = await import('./lat-long.fixture')
        fixture = await createLatLongFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('distanceInMeters', () => {
        it('calculates the distance between two coordinates', () => {
            const seoul: LatLong = { latitude: 37.5665, longitude: 126.978 }
            const busan: LatLong = { latitude: 35.1796, longitude: 129.0756 }

            const actualDistance = LatLong.distanceInMeters(seoul, busan)

            const expectedDistance = 325000
            const tolerance = 0.05 * expectedDistance // 5% 오차 범위

            expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
            expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
        })
    })

    describe('GET /latLong', () => {
        describe('when the query is valid', () => {
            it('returns the latitude and longitude', async () => {
                await fixture.httpClient
                    .get('/latLong')
                    .query({ location: '37.123,128.678' })
                    .ok({ latitude: 37.123, longitude: 128.678 })
            })
        })

        describe('when the latLong value is missing', () => {
            it('throws BadRequestException', async () => {
                await fixture.httpClient
                    .get('/latLong')
                    .badRequest({
                        code: 'ERR_LATLONG_REQUIRED',
                        message: 'The latLong query parameter is required'
                    })
            })
        })

        describe('when the latLong format is invalid', () => {
            it('throws BadRequestException', async () => {
                await fixture.httpClient
                    .get('/latLong')
                    .query({ location: '37.123' })
                    .badRequest({
                        code: 'ERR_LATLONG_FORMAT_INVALID',
                        message: 'LatLong should be in the format "latitude,longitude"'
                    })
            })
        })

        describe('when the values are out of range', () => {
            it('throws BadRequestException', async () => {
                await fixture.httpClient
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
