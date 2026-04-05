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
        // 키가 존재할 때
        describe('when the key exists', () => {
            // 문자열 값을 반환한다
            it('returns the string value', () => {
                const result = fix.appConfigService.getString('TEST_STRING_KEY')
                expect(result).toBe('value')
            })
        })

        // 키가 존재하지 않을 때
        describe('when the key does not exist', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => fix.appConfigService.getString('not-exists-key')).toThrow(
                    "Key 'not-exists-key' is not defined"
                )
            })
        })

        // 값이 빈 문자열일 때
        describe('when the value is an empty string', () => {
            // 예외를 던진다
            it('throws an error', () => {
                class TestConfigService extends BaseConfigService {
                    constructor(configService: ConfigService) {
                        super(configService)
                    }
                }

                const configService = { get: () => '' } as unknown as ConfigService
                const service = new TestConfigService(configService)

                expect(() => service.getString('EMPTY_KEY')).toThrow(
                    "Key 'EMPTY_KEY' is not defined"
                )
            })
        })
    })

    describe('getNumber', () => {
        // 키가 존재할 때
        describe('when the key exists', () => {
            // 숫자 값을 반환한다
            it('returns the number value', () => {
                const result = fix.appConfigService.getNumber('TEST_NUMBER_KEY')
                expect(result).toBe(123)
            })
        })

        // 값이 0인 키가 존재할 때
        describe('when the key exists with the value 0', () => {
            // 0을 반환한다
            it('returns 0', () => {
                const result = fix.appConfigService.getNumber('TEST_NUMBER_ZERO_KEY')
                expect(result).toBe(0)
            })
        })

        // 키가 존재하지 않을 때
        describe('when the key does not exist', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => fix.appConfigService.getNumber('not-exists-key')).toThrow(
                    "Key 'not-exists-key' is not defined"
                )
            })
        })
    })

    describe('getBoolean', () => {
        // 키가 존재할 때
        describe('when the key exists', () => {
            // 불리언 값을 반환한다
            it('returns the boolean value', () => {
                const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_KEY')
                expect(result).toBe(true)
            })
        })

        // 값이 false인 키가 존재할 때
        describe('when the key exists with the value false', () => {
            // false를 반환한다
            it('returns false', () => {
                const result = fix.appConfigService.getBoolean('TEST_BOOLEAN_FALSE_KEY')
                expect(result).toBe(false)
            })
        })

        // 키가 존재하지 않을 때
        describe('when the key does not exist', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => fix.appConfigService.getBoolean('not-exists-key')).toThrow(
                    "Key 'not-exists-key' is not defined"
                )
            })
        })
    })
})
