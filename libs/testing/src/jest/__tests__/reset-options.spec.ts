import { getCounter, incrementCounter } from './reset-options.fixture'

describe('Jest reset options', () => {
    describe('resetModules가 활성화되었을 때', () => {
        describe('정적으로 import할 때', () => {
            it('카운터를 증가시킨다', () => {
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            it('모듈 캐시로 인해 테스트 간 증가 값이 유지된다', () => {
                expect(getCounter()).toBe(1)
            })
        })

        describe('동적으로 import할 때', () => {
            it('카운터를 증가시킨다', async () => {
                const { getCounter: getCounterDynamic, incrementCounter: incrementCounterDynamic } =
                    await import('./reset-options.fixture')
                expect(getCounterDynamic()).toBe(0)
                incrementCounterDynamic()
                expect(getCounterDynamic()).toBe(1)
            })

            it('다음 테스트에서 새 카운터로 시작한다', async () => {
                const { getCounter: getCounterDynamic } = await import('./reset-options.fixture')

                expect(getCounterDynamic()).toBe(0)
            })
        })
    })

    const sharedMock = jest.fn()

    describe('resetMocks가 활성화되었을 때', () => {
        it('목 호출을 기록한다', () => {
            sharedMock('first')
            expect(sharedMock).toHaveBeenCalledTimes(1)
        })

        it('테스트 사이에 목 호출 횟수를 초기화한다', () => {
            expect(sharedMock).toHaveBeenCalledTimes(0)
        })
    })

    describe('restoreMocks가 활성화되었을 때', () => {
        it('Date.now를 오버라이드한다', () => {
            jest.spyOn(Date, 'now').mockReturnValue(42)
            expect(Date.now()).toBe(42)
        })

        it('테스트 사이에 Date.now를 복원한다', () => {
            expect(Date.now()).not.toBe(42)
        })
    })
})
