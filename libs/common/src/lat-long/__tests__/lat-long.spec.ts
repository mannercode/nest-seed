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

        it.todo('극점(위도 ±90) 좌표끼리의 거리를 정확히 계산한다')

        it.todo('정반대 좌표 사이의 거리는 지구 둘레의 절반에 가깝다')

        it.todo('1m 미만 정밀도가 필요한 매우 가까운 좌표 차이도 안정적으로 계산한다')

        it.todo('지수 표기법(예: "1.23e-5")도 Number() 결과대로 파싱한다')
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

        it.todo('"123."처럼 끝에 점이 붙은 좌표는 Number("123.") = 123으로 파싱된다')

        it.todo('좌표 문자열이 정확히 20자이면 정상 파싱된다')

        it('범위를 벗어난 좌표는 400을 반환한다', async () => {
            await fix.httpClient
                .get('/latLong')
                .query({ location: '91,181' })
                .badRequest(LatLongErrors.OutOfRange(expect.any(Array)))
        })
    })
})
