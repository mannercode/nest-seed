import { getCounter, incrementCounter } from './reset-options.fixture'

// Jest 재설정 옵션 검증
describe('Verify Jest reset options', () => {
    describe('resetModules: true', () => {
        // 정적 import인 경우
        describe('with static import', () => {
            // 첫 번째 테스트에서 카운터를 증가시킨다
            it('increments counter in the first test', () => {
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            // 모듈 캐시 때문에 테스트 간에 증가된 값이 유지된다
            it('retains incremented value across tests due to module cache', () => {
                expect(getCounter()).toBe(1)
            })
        })

        // 동적 import인 경우
        describe('with dynamic import', () => {
            // 같은 테스트 안에서는 상태가 유지된다
            it('increments counter within the same test', async () => {
                const { getCounter, incrementCounter } = await import('./reset-options.fixture')
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            // 다음 테스트에서는 모듈 캐시가 초기화돼 0으로 시작한다
            it('starts with fresh counter (0) in subsequent test because cache is cleared', async () => {
                const { getCounter } = await import('./reset-options.fixture')

                expect(getCounter()).toBe(0)
            })
        })
    })

    const sharedMock = jest.fn()

    describe('resetMocks: true', () => {
        // 첫 번째 테스트에서 호출 횟수를 기록한다
        it('records calls in the first test', () => {
            sharedMock('first')
            expect(sharedMock).toHaveBeenCalledTimes(1)
        })

        // 다음 테스트 전에 호출 횟수를 초기화 한다
        it('resets mock call counts before the next test', () => {
            expect(sharedMock).toHaveBeenCalledTimes(0)
        })
    })

    describe('restoreMocks: true', () => {
        // 첫 번째 테스트에서 Date.now를 덮어쓴다
        it('overrides Date.now in the first test', () => {
            jest.spyOn(Date, 'now').mockReturnValue(42)
            expect(Date.now()).toBe(42)
        })

        // 각 테스트가 끝난 후 Date.now를 원래대로 돌려놓는다
        it('restores original Date.now between tests', () => {
            expect(Date.now()).not.toBe(42)
        })
    })
})
