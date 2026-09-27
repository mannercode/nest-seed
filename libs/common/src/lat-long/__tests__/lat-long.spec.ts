import { type LatLongFixture, createLatLongFixture } from './lat-long.fixture.js'
import { LatLong, LatLongErrors } from '../index.js'

describe('LatLong', () => {
    let fix: LatLongFixture

    beforeEach(async () => {
        fix = await createLatLongFixture()
    })
    afterEach(() => fix.teardown())

    describe('distanceInMeters', () => {
        describe('서울과 부산의 좌표가 있으면', () => {
            let seoul: Parameters<typeof LatLong.distanceInMeters>[0]
            let busan: Parameters<typeof LatLong.distanceInMeters>[0]
            beforeEach(() => {
                seoul = { latitude: 37.5665, longitude: 126.978 }
                busan = { latitude: 35.1796, longitude: 129.0756 }
            })
            it('거리를 계산하면 약 325km를 반환한다', () => {
                const actualDistance = LatLong.distanceInMeters(seoul, busan)

                const expectedDistance = 325000
                const tolerance = 0.05 * expectedDistance

                expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
                expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
            })
        })

        describe('두 좌표가 북극과 남극이면', () => {
            let northPole: Parameters<typeof LatLong.distanceInMeters>[0]
            let southPole: Parameters<typeof LatLong.distanceInMeters>[0]
            beforeEach(() => {
                northPole = { latitude: 90, longitude: 0 }
                southPole = { latitude: -90, longitude: 0 }
            })
            it('거리를 계산하면 지구 둘레의 절반을 반환한다', () => {
                const distance = LatLong.distanceInMeters(northPole, southPole)

                // 극점 사이 거리는 지구 반지름 × π(약 20015km)로, 지구 둘레의 절반이다.
                expect(distance).toBeCloseTo(Math.PI * 6_371_000, -3)
            })
        })

        describe('두 좌표가 정반대 지점이면', () => {
            let seoul: Parameters<typeof LatLong.distanceInMeters>[0]
            let antipode: Parameters<typeof LatLong.distanceInMeters>[0]
            beforeEach(() => {
                seoul = { latitude: 37.5665, longitude: 126.978 }
                antipode = { latitude: -37.5665, longitude: 126.978 - 180 }
            })
            it('거리를 계산하면 지구 둘레의 절반을 반환한다', () => {
                const distance = LatLong.distanceInMeters(seoul, antipode)
                const halfCircumference = Math.PI * 6_371_000

                expect(Math.abs(distance - halfCircumference)).toBeLessThan(
                    halfCircumference * 0.005
                )
            })
        })

        describe('정반대 좌표의 거리 계산에 반올림 오차가 생기는 입력이면', () => {
            let from: Parameters<typeof LatLong.distanceInMeters>[0]
            let to: Parameters<typeof LatLong.distanceInMeters>[0]
            beforeEach(() => {
                from = { latitude: 0.08, longitude: 0 }
                to = { latitude: -0.08, longitude: 180 }
            })
            it('거리를 계산하면 유한한 값과 대칭성을 유지한다', () => {
                const distance = LatLong.distanceInMeters(from, to)

                expect(Number.isFinite(distance)).toBe(true)
                expect(distance).toBeCloseTo(Math.PI * 6_371_000, 5)
                expect(LatLong.distanceInMeters(to, from)).toBe(distance)
                expect(LatLong.distanceInMeters(from, from)).toBe(0)
            })
        })

        describe('두 좌표의 위도 차이가 0.0000001도이면', () => {
            let a: Parameters<typeof LatLong.distanceInMeters>[0]
            let b: Parameters<typeof LatLong.distanceInMeters>[0]
            beforeEach(() => {
                a = { latitude: 37.5, longitude: 127.0 }
                b = { latitude: 37.5 + 1e-7, longitude: 127.0 }
            })
            it('거리를 계산하면 0m보다 크고 1m보다 작은 값을 반환한다', () => {
                const distance = LatLong.distanceInMeters(a, b)

                expect(distance).toBeGreaterThan(0)
                expect(distance).toBeLessThan(1)
            })
        })
    })

    describe('GET /latLong', () => {
        describe('좌표 문자열의 형식과 범위가 유효하면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '37.123,128.678' })
            })
            it('좌표를 요청하면 위도와 경도를 반환한다', async () => {
                await request.ok({ expected: { latitude: 37.123, longitude: 128.678 } })
            })
        })

        describe('location 쿼리가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong')
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.Required() })
            })
        })

        describe('좌표 문자열에 콤마가 없으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '37.123' })
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('location 쿼리 값이 배열이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/latLong')
                    .query({ location: ['37.123,128.678', '38.123,129.678'] })
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('좌표 문자열에 값이 세 개 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '37.123,128.678,999' })
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('좌표 문자열에 숫자가 아닌 값이 포함되면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '37abc,127xyz' })
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('좌표 값의 길이가 20자를 넘으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .get('/latLong')
                    .query({ location: '123456789012345678901,127' })
            })
            it('좌표를 요청하면 400을 반환한다', async () => {
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('좌표 값이 "37."처럼 점으로 끝나면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '37.,127' })
            })
            it('좌표를 요청하면 숫자 37로 변환한다', async () => {
                // 정규식의 \d+(?:\.\d*)? 분기가 "37."을 받아주므로 정상 파싱된다.
                await request.ok({ expected: { latitude: 37, longitude: 127 } })
            })
        })

        describe('좌표가 길이 제한 이내이지만 허용 범위를 벗어나면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                const lat = '12345678901234567.89'
                request = fix.httpClient.get('/latLong').query({ location: `${lat},127` })
            })
            it('좌표를 요청하면 범위 오류를 담은 400을 반환한다', async () => {
                // 20자
                await request.badRequest({ expected: LatLongErrors.OutOfRange(expect.any(Array)) })
            })
        })

        describe('좌표 값이 지수 표기법으로 작성되어 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '1.23e-5,127' })
            })
            it('좌표를 요청하면 형식 오류를 담은 400을 반환한다', async () => {
                // 정규식이 e를 허용하지 않으므로 거부된다.
                await request.badRequest({ expected: LatLongErrors.InvalidFormat() })
            })
        })

        describe('위도와 경도가 허용 상한을 넘으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '91,181' })
            })
            it('좌표를 요청하면 상한 오류를 담은 400을 반환한다', async () => {
                await request.badRequest({
                    expected: LatLongErrors.OutOfRange([
                        {
                            constraints: { max: 'latitude must not be greater than 90' },
                            field: 'latitude'
                        },
                        {
                            constraints: { max: 'longitude must not be greater than 180' },
                            field: 'longitude'
                        }
                    ])
                })
            })
        })

        describe('위도와 경도가 허용 하한보다 작으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/latLong').query({ location: '-91,-181' })
            })
            it('좌표를 요청하면 하한 오류를 담은 400을 반환한다', async () => {
                await request.badRequest({
                    expected: LatLongErrors.OutOfRange([
                        {
                            constraints: { min: 'latitude must not be less than -90' },
                            field: 'latitude'
                        },
                        {
                            constraints: { min: 'longitude must not be less than -180' },
                            field: 'longitude'
                        }
                    ])
                })
            })
        })
    })
})
