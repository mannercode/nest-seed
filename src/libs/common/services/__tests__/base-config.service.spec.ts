import type { Fixture } from './base-config.service.fixture'

describe('BaseConfigService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./base-config.service.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('getString', () => {
        // key에 해당하는 문자열을 반환해야 한다
        it('Should return a string for the specified key', () => {
            const result = fix.appConfigService.getString('TEST_STRING_KEY')
            expect(result).toBe('value')
        })

        // 존재하지 않는 key를 요청하면 프로세스를 종료해야 한다
        it('Should exit the process if the requested key does not exist', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getString('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })

    describe('getNumber', () => {
        // key에 해당하는 숫자를 반환해야 한다
        it('Should return a number for the specified key', () => {
            const result = fix.appConfigService.getNumber('TEST_NUMBER_KEY')
            expect(result).toBe(123)
        })

        // 존재하지 않는 key를 요청하면 프로세스를 종료해야 한다
        it('Should exit the process if the requested key does not exist', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getNumber('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })

    describe('getBoolean', () => {
        // key에 해당하는 boolean을 반환해야 한다
        it('Should return a boolean for the specified key', () => {
            const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
            expect(result).toBe(true)
        })

        // 존재하지 않는 key를 요청하면 프로세스를 종료해야 한다
        it('Should exit the process if the requested key does not exist', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation()
            jest.spyOn(console, 'error').mockImplementation()

            fix.appConfigService.getBoolean('not-exists-key')

            expect(mockExit).toHaveBeenCalledWith(1)
        })
    })
})
