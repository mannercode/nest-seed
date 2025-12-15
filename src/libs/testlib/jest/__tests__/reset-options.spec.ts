import { getCounter, incrementCounter } from './reset-options.fixture'

describe('Jest reset options', () => {
    describe('when resetModules is enabled', () => {
        describe('when importing statically', () => {
            it('increments the counter', () => {
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            it('retains incremented value across tests due to module cache', () => {
                expect(getCounter()).toBe(1)
            })
        })

        describe('when importing dynamically', () => {
            it('increments the counter', async () => {
                const { getCounter, incrementCounter } = await import('./reset-options.fixture')
                expect(getCounter()).toBe(0)
                incrementCounter()
                expect(getCounter()).toBe(1)
            })

            it('starts with a fresh counter in the next test', async () => {
                const { getCounter } = await import('./reset-options.fixture')

                expect(getCounter()).toBe(0)
            })
        })
    })

    const sharedMock = jest.fn()

    describe('when resetMocks is enabled', () => {
        it('records mock calls', () => {
            sharedMock('first')
            expect(sharedMock).toHaveBeenCalledTimes(1)
        })

        it('resets mock call counts between tests', () => {
            expect(sharedMock).toHaveBeenCalledTimes(0)
        })
    })

    describe('when restoreMocks is enabled', () => {
        it('overrides Date.now', () => {
            jest.spyOn(Date, 'now').mockReturnValue(42)
            expect(Date.now()).toBe(42)
        })

        it('restores Date.now between tests', () => {
            expect(Date.now()).not.toBe(42)
        })
    })
})
