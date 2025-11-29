import type { Fixture } from './base-config.service.fixture'

describe('BaseConfigService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./base-config.service.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('getString', () => {
        describe('when the key exists', () => {
            it('returns the string value', () => {
                const result = fixture.appConfigService.getString('TEST_STRING_KEY')
                expect(result).toBe('value')
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getString('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getNumber', () => {
        describe('when the key exists', () => {
            it('returns the number value', () => {
                const result = fixture.appConfigService.getNumber('TEST_NUMBER_KEY')
                expect(result).toBe(123)
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getNumber('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getBoolean', () => {
        describe('when the key exists', () => {
            it('returns the boolean value', () => {
                const result = fixture.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
                expect(result).toBe(true)
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getBoolean('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })
})
