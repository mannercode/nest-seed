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
        // key가 존재하는 경우
        describe('when the key exists', () => {
            // 해당 문자열을 반환한다
            it('returns the string value', () => {
                const result = fixture.appConfigService.getString('TEST_STRING_KEY')
                expect(result).toBe('value')
            })
        })

        // key가 존재하지 않는 경우
        describe('when the key does not exist', () => {
            // 프로세스를 종료한다
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getString('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getNumber', () => {
        // key가 존재하는 경우
        describe('when the key exists', () => {
            // 해당 숫자를 반환한다
            it('returns the number value', () => {
                const result = fixture.appConfigService.getNumber('TEST_NUMBER_KEY')
                expect(result).toBe(123)
            })
        })

        // key가 존재하지 않는 경우
        describe('when the key does not exist', () => {
            // 프로세스를 종료한다
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getNumber('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })

    describe('getBoolean', () => {
        // key가 존재하는 경우
        describe('when the key exists', () => {
            // 해당 boolean을 반환한다
            it('returns the boolean value', () => {
                const result = fixture.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
                expect(result).toBe(true)
            })
        })

        // key가 존재하지 않는 경우
        describe('when the key does not exist', () => {
            // 프로세스를 종료한다
            it('exits the process', () => {
                const mockExit = jest.spyOn(process, 'exit').mockImplementation()
                jest.spyOn(console, 'error').mockImplementation()

                fixture.appConfigService.getBoolean('not-exists-key')

                expect(mockExit).toHaveBeenCalledWith(1)
            })
        })
    })
})
