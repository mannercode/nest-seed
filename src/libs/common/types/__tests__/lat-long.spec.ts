import { LatLong } from 'common'

describe('LatLong', () => {
    it('두 위경도 간의 거리를 미터 단위로 계산해야 한다', () => {
        // 서울의 위경도
        const seoul: LatLong = {
            latitude: 37.5665,
            longitude: 126.978
        }

        // 부산의 위경도
        const busan: LatLong = {
            latitude: 35.1796,
            longitude: 129.0756
        }

        // 서울과 부산 사이의 대략적인 거리 (약 325km)
        const expectedDistance = 325000

        // 함수로부터 실제 거리를 구함
        const actualDistance = LatLong.distanceInMeters(seoul, busan)

        // 오차 범위(5%)를 설정
        const tolerance = 0.05 * expectedDistance

        // 실제 거리가 예상 범위 내에 있는지 확인
        expect(actualDistance).toBeGreaterThan(expectedDistance - tolerance)
        expect(actualDistance).toBeLessThan(expectedDistance + tolerance)
    })
})
