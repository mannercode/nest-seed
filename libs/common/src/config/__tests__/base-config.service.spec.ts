import type { ConfigService } from '@nestjs/config'
import type { BaseConfigServiceFixture } from './base-config.service.fixture'
import { BaseConfigService } from '../base-config.service'

describe('BaseConfigService', () => {
    let fix: BaseConfigServiceFixture

    beforeEach(async () => {
        process.env['TEST_STRING_KEY'] = 'value'
        process.env['TEST_NUMBER_KEY'] = '123'
        process.env['TEST_NUMBER_ZERO_KEY'] = '0'
        process.env['TEST_BOOLEAN_KEY'] = 'true'
        process.env['TEST_BOOLEAN_FALSE_KEY'] = 'false'

        const { createBaseConfigServiceFixture } = await import('./base-config.service.fixture')
        fix = await createBaseConfigServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('getString', () => {
        it('키가 존재하면 문자열을 반환한다', () => {
            const result = fix.appConfigService.getString('TEST_STRING_KEY')
            expect(result).toBe('value')
        })

        it('환경변수가 정의되어 있지 않으면 예외를 던진다', () => {
            class TestConfigService extends BaseConfigService {
                constructor(configService: ConfigService) {
                    super(configService)
                }
            }

            const configService = { get: () => undefined } as unknown as ConfigService
            const service = new TestConfigService(configService)

            expect(() => service.getString('SOME_KEY')).toThrow("Key 'SOME_KEY' is not defined")
        })

        it('환경변수 값이 빈 문자열이면 예외를 던진다', () => {
            class TestConfigService extends BaseConfigService {
                constructor(configService: ConfigService) {
                    super(configService)
                }
            }

            const configService = { get: () => '' } as unknown as ConfigService
            const service = new TestConfigService(configService)

            expect(() => service.getString('SOME_KEY')).toThrow("Key 'SOME_KEY' is not defined")
        })
    })

    describe('getNumber', () => {
        it('키가 존재하면 숫자를 반환한다', () => {
            const result = fix.appConfigService.getNumber('TEST_NUMBER_KEY')
            expect(result).toBe(123)
        })

        it('값이 0이면 0을 반환한다', () => {
            const result = fix.appConfigService.getNumber('TEST_NUMBER_ZERO_KEY')
            expect(result).toBe(0)
        })

        it('키가 없으면 예외를 던진다', () => {
            expect(() => fix.appConfigService.getNumber('not-exists-key')).toThrow(
                "Key 'not-exists-key' is not defined"
            )
        })
    })

    describe('getBoolean', () => {
        it('키가 존재하면 불리언을 반환한다', () => {
            const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
            expect(result).toBe(true)
        })

        it('값이 false이면 false를 반환한다', () => {
            const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_FALSE_KEY')
            expect(result).toBe(false)
        })

        it('키가 없으면 예외를 던진다', () => {
            expect(() => fix.appConfigService.getBoolean('not-exists-key')).toThrow(
                "Key 'not-exists-key' is not defined"
            )
        })
    })
})
