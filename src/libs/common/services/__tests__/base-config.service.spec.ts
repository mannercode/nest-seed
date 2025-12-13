import type { BaseConfigServiceFixture } from './base-config.service.fixture'

describe('BaseConfigService', () => {
    let fix: BaseConfigServiceFixture

    beforeEach(async () => {
        const { createBaseConfigServiceFixture } = await import('./base-config.service.fixture')
        fix = await createBaseConfigServiceFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('getString', () => {
        describe('when the key exists', () => {
            it('returns the string value', () => {
                const result = fix.appConfigService.getString('TEST_STRING_KEY')
                expect(result).toBe('value')
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fix.appConfigService.getString('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getNumber', () => {
        describe('when the key exists', () => {
            it('returns the number value', () => {
                const result = fix.appConfigService.getNumber('TEST_NUMBER_KEY')
                expect(result).toBe(123)
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fix.appConfigService.getNumber('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getBoolean', () => {
        describe('when the key exists', () => {
            it('returns the boolean value', () => {
                const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
                expect(result).toBe(true)
            })
        })

        describe('when the key does not exist', () => {
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fix.appConfigService.getBoolean('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })
})
