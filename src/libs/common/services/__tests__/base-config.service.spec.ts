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
        it('returns the string value for an existing key', () => {
            const result = fix.appConfigService.getString('TEST_STRING_KEY')
            expect(result).toBe('value')
        })

        it('exits the process for a missing key', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getString('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })

    describe('getNumber', () => {
        it('returns the number value for an existing key', () => {
            const result = fix.appConfigService.getNumber('TEST_NUMBER_KEY')
            expect(result).toBe(123)
        })

        it('returns 0 for an existing key with the value 0', () => {
            const result = fix.appConfigService.getNumber('TEST_NUMBER_ZERO_KEY')
            expect(result).toBe(0)
        })

        it('exits the process for a missing key', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getNumber('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })

    describe('getBoolean', () => {
        it('returns the boolean value for an existing key', () => {
            const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
            expect(result).toBe(true)
        })

        it('returns false for an existing key with the value false', () => {
            const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_FALSE_KEY')
            expect(result).toBe(false)
        })

        it('exits the process for a missing key', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getBoolean('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })
})
