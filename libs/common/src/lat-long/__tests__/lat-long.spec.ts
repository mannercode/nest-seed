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

        it.todo('극점 (위도 ±90) 좌표끼리의 거리를 정확히 계산한다')

        it.todo('정반대 (antipode) 좌표 간 거리는 지구 둘레의 절반에 근접한다')

        it.todo('1m 미만 정밀도가 필요한 매우 가까운 좌표 차이도 안정적으로 계산한다')

        it.todo(
            'coordinate 문자열의 scientific notation (예: "1.23e-5") 도 Number() 결과대로 파싱된다'
        )
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

            it('location 이 여러 번 전달되면 400 Bad Request 를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: ['37.123,128.678', '38.123,129.678'] })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('좌표가 추가로 전달되면 400 Bad Request 를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37.123,128.678,999' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('숫자가 아닌 값이 전달되면 400 Bad Request 를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '37abc,127xyz' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it('좌표가 20자리를 초과하면 400 Bad Request 를 반환한다', async () => {
                await fix.httpClient
                    .get('/latLong')
                    .query({ location: '123456789012345678901,127' })
                    .badRequest(LatLongErrors.InvalidFormat())
            })

            it.todo(
                '"123." 처럼 trailing dot 으로 끝나는 좌표는 isNumericString regex 가 허용해 Number("123.") = 123 으로 파싱된다'
            )
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
