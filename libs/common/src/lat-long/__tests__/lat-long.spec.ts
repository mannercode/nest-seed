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
        it('두 좌표 사이의 거리를 계산한다', () => {
            const seoul = { latitude: 37.5665, longitude: 126.978 }
            const busan = { latitude: 35.1796, longitude: 129.0756 }

            const actualDistance = LatLong.distanceInMeters(seoul, busan)

            const expectedDistance = 325000
            const tolerance = 0.05 * expectedDistance

            expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
            expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
        })

        it('극점(위도 ±90) 좌표끼리의 거리를 정확히 계산한다', () => {
            const northPole = { latitude: 90, longitude: 0 }
            const southPole = { latitude: -90, longitude: 0 }

            const distance = LatLong.distanceInMeters(northPole, southPole)

            // 지구 반지름 × π = 약 20015 km. 측지선 길이의 절반.
            expect(distance).toBeCloseTo(Math.PI * 6_371_000, -3)
        })

        it('정반대 좌표 사이의 거리는 지구 둘레의 절반에 가깝다', () => {
            const seoul = { latitude: 37.5665, longitude: 126.978 }
            const antipode = { latitude: -37.5665, longitude: 126.978 - 180 }

            const distance = LatLong.distanceInMeters(seoul, antipode)
            const halfCircumference = Math.PI * 6_371_000

            expect(Math.abs(distance - halfCircumference)).toBeLessThan(halfCircumference * 0.005)
        })

        it('1m 미만 정밀도가 필요한 매우 가까운 좌표 차이도 안정적으로 계산한다', () => {
            const a = { latitude: 37.5, longitude: 127.0 }
            const b = { latitude: 37.5 + 1e-7, longitude: 127.0 }

            const distance = LatLong.distanceInMeters(a, b)

            expect(distance).toBeGreaterThan(0)
            expect(distance).toBeLessThan(1)
        })
    })

    describe('GET /latLong', () => {
        it('쿼리가 유효하면 위도와 경도를 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '37.123,128.678' })
                .ok({ latitude: 37.123, longitude: 128.678 })
        })

        it('쿼리가 없으면 400을 반환한다', async () => {
            await fix.httpClient.get('/latLong').badRequest(LatLongErrors.Required())
        })

        it('쿼리에 콤마가 없으면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '37.123' })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('location이 여러 번 전달되면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: ['37.123,128.678', '38.123,129.678'] })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('좌표가 세 개 이상이면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '37.123,128.678,999' })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('숫자가 아닌 값이 포함되면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '37abc,127xyz' })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('좌표가 20자리를 초과하면 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '123456789012345678901,127' })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('"37."처럼 끝에 점이 붙은 좌표는 Number("37.") = 37로 파싱된다', async () => {
            // 정규식의 \d+(?:\.\d*)? 분기가 "37."을 받아주므로 정상 파싱된다.
            await fix.httpClient
                .get('/latLong')
                .query({ location: '37.,127' })
                .ok({ latitude: 37, longitude: 127 })
        })

        it('정확히 20자(MAX_COORDINATE_LENGTH 경계)인 좌표는 길이 체크를 통과한다', async () => {
            // 길이 체크는 통과하지만 값이 90 초과라 범위 검증에서 거부된다.
            const lat = '12345678901234567.89' // 20자
            await fix.httpClient
                .get('/latLong')
                .query({ location: `${lat},127` })
                .badRequest(LatLongErrors.OutOfRange(expect.any(Array)))
        })

        it('지수 표기법(1.23e-5)은 형식 오류로 거부된다', async () => {
            // 정규식이 e를 허용하지 않으므로 거부된다.
            await fix.httpClient
                .get('/latLong')
                .query({ location: '1.23e-5,127' })
                .badRequest(LatLongErrors.InvalidFormat())
        })

        it('범위를 벗어난 좌표는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '91,181' })
                .badRequest(LatLongErrors.OutOfRange(expect.any(Array)))
        })
    })
})
