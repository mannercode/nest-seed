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

    // 두 위경도 간의 거리를 미터 단위로 계산해야 한다
    it('Should calculate the distance in meters between two coordinates', () => {
        const seoul: LatLong = { latitude: 37.5665, longitude: 126.978 }
        const busan: LatLong = { latitude: 35.1796, longitude: 129.0756 }

        const actualDistance = LatLong.distanceInMeters(seoul, busan)

        const expectedDistance = 325000
        const tolerance = 0.05 * expectedDistance // 5% 오차 범위

        expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
        expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
    })

    // 유효한 위경도 쿼리를 처리해야 한다
    it('Should handle a valid lat-long query', async () => {
        await fix.httpClient
            .get('/latLong')
            .query({ location: '37.123,128.678' })
            .ok({ latitude: 37.123, longitude: 128.678 })
    })

    // latLong 값이 없으면 BadRequestException을 던져야 한다
    it('Should throw a BadRequestException if no latLong value is provided', async () => {
        await fix.httpClient
            .get('/latLong')
            .badRequest({
                code: 'ERR_LATLONG_REQUIRED',
                message: 'The latLong query parameter is required'
            })
    })

    // 잘못된 형식인 경우 BadRequestException을 던져야 한다
    it('Should throw a BadRequestException if the latLong format is invalid', async () => {
        await fix.httpClient
            .get('/latLong')
            .query({ location: '37.123' })
            .badRequest({
                code: 'ERR_LATLONG_FORMAT_INVALID',
                message: 'LatLong should be in the format "latitude,longitude"'
            })
    })

    // 범위를 벗어난 값인 경우 BadRequestException을 던져야 한다
    it('Should throw a BadRequestException if values are out of range', async () => {
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
