import { getCounter, incrementCounter } from './reset-modules.fixture'

/**
 * - 배경
 * 테스트에서 Nats 서버를 공유하기 떄문에 유니크한 subject를 생성하기 위해서 process.env.TEST_ID를 사용함.
 *
 * - 문제
 * Jest의 module cache 기능 때문에 @MessagePattern 데코레이터는 모듈 로딩 시에 한 번만 평가된다.
 * 따라서 최상위에서 이미 import된 모듈의 경우 각 테스트마다 다른 process.env.TEST_ID 값을 반영하지 못합니다.
 *
 * - 해결 방법
 * resetModules: true로 설정해서 각 테스트 마다 module cache를 초기화합니다.
 *
 * 아래 테스트는 문제 검증과 해결 방법을 보여줍니다.
*/

describe('resetModules 기능 검증', () => {
    it('카운터 초기값 확인 및 증가 테스트', () => {
        expect(getCounter()).toBe(0)
        incrementCounter()
        expect(getCounter()).toBe(1)
    })

    it('resetModules가 true여도 모듈 캐시로 인한 상태가 유지됨', () => {
        expect(getCounter()).toBe(1)
    })

    it('동적 모듈 임포트를 하면 최상위 import에 의한 모듈 캐시에 영향을 받지 않음', async () => {
        const { getCounter: getFreshCounter } = await import('./reset-modules.fixture')

        expect(getFreshCounter()).toBe(0)
    })
})
