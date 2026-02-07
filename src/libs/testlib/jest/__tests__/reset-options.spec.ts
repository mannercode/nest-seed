import { getCounter, incrementCounter } from './reset-options.fixture'

describe('Jest reset options', () => {
    // resetModules가 활성화되었을 때
    describe('when resetModules is enabled', () => {
        // 정적으로 import할 때
        describe('when importing statically', () => {
            // 카운터를 증가시킨다
            it('increments the counter', () => {
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            // 모듈 캐시로 인해 테스트 간 증가 값이 유지된다
            it('retains incremented value across tests due to module cache', () => {
                expect(getCounter()).toBe(1)
            })
        })

        // 동적으로 import할 때
        describe('when importing dynamically', () => {
            // 카운터를 증가시킨다
            it('increments the counter', async () => {
                const { getCounter: getCounterDynamic, incrementCounter: incrementCounterDynamic } =
                    await import('./reset-options.fixture')
                expect(getCounterDynamic()).toBe(0)
                incrementCounterDynamic()
                expect(getCounterDynamic()).toBe(1)
            })

            // 다음 테스트에서 새 카운터로 시작한다
            it('starts with a fresh counter in the next test', async () => {
                const { getCounter: getCounterDynamic } = await import('./reset-options.fixture')

                expect(getCounterDynamic()).toBe(0)
            })
        })
    })

    const sharedMock = jest.fn()

    // resetMocks가 활성화되었을 때
    describe('when resetMocks is enabled', () => {
        // 목 호출을 기록한다
        it('records mock calls', () => {
            sharedMock('first')
            expect(sharedMock).toHaveBeenCalledTimes(1)
        })

        // 테스트 사이에 목 호출 횟수를 초기화한다
        it('resets mock call counts between tests', () => {
            expect(sharedMock).toHaveBeenCalledTimes(0)
        })
    })

    // restoreMocks가 활성화되었을 때
    describe('when restoreMocks is enabled', () => {
        // Date.now를 오버라이드한다
        it('overrides Date.now', () => {
            jest.spyOn(Date, 'now').mockReturnValue(42)
            expect(Date.now()).toBe(42)
        })

        // 테스트 사이에 Date.now를 복원한다
        it('restores Date.now between tests', () => {
            expect(Date.now()).not.toBe(42)
        })
    })
})
