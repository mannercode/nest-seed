import { getCounter, incrementCounter } from './reset-options.fixture'

describe('Verify Jest reset options', () => {
    describe('resetModules: true', () => {
        describe('with static import', () => {
            it('increments counter in the first test', () => {
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            it('retains incremented value across tests due to module cache', () => {
                expect(getCounter()).toBe(1)
            })
        })

        describe('with dynamic import', () => {
            it('increments counter within the same test', async () => {
                const { getCounter, incrementCounter } = await import('./reset-options.fixture')
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            it('starts with fresh counter (0) in subsequent test because cache is cleared', async () => {
                const { getCounter } = await import('./reset-options.fixture')

                expect(getCounter()).toBe(0)
            })
        })
    })

    const sharedMock = jest.fn()

    describe('resetMocks: true', () => {
        it('records calls in the first test', () => {
            sharedMock('first')
            expect(sharedMock).toHaveBeenCalledTimes(1)
        })

        it('resets mock call counts before the next test', () => {
            expect(sharedMock).toHaveBeenCalledTimes(0)
        })
    })

    describe('restoreMocks: true', () => {
        it('overrides Date.now in the first test', () => {
            jest.spyOn(Date, 'now').mockReturnValue(42)
            expect(Date.now()).toBe(42)
        })

        it('restores original Date.now between tests', () => {
            expect(Date.now()).not.toBe(42)
        })
    })
})
