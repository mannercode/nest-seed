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

        // ConfigService 가 schema coercion 없이 string 으로 돌려줘도 BaseConfigService
        // 가 자체 변환을 책임진다는 contract 검증.
        it('coercion 없이 들어온 숫자 문자열도 number 로 변환한다', () => {
            const service = createServiceWithConfig({ N: '42' })
            expect(service.getNumber('N')).toBe(42)
        })

        it('숫자가 아닌 문자열이면 finite-number 메시지로 예외를 던진다', () => {
            const service = createServiceWithConfig({ N: 'abc' })
            expect(() => service.getNumber('N')).toThrow("Key 'N' is not a finite number: 'abc'")
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

        it('coercion 없이 들어온 "true" / "false" 문자열도 변환한다', () => {
            const service = createServiceWithConfig({ T: 'true', F: 'false' })
            expect(service.getBoolean('T')).toBe(true)
            expect(service.getBoolean('F')).toBe(false)
        })

        it('대소문자 / 공백 변형도 받아준다', () => {
            const service = createServiceWithConfig({ T: '  TRUE  ', F: 'False' })
            expect(service.getBoolean('T')).toBe(true)
            expect(service.getBoolean('F')).toBe(false)
        })

        it('true / false 가 아닌 문자열이면 boolean 메시지로 예외를 던진다', () => {
            const service = createServiceWithConfig({ B: 'maybe' })
            expect(() => service.getBoolean('B')).toThrow("Key 'B' is not a boolean: 'maybe'")
        })
    })
})

class TestConfigService extends BaseConfigService {
    constructor(configService: ConfigService) {
        super(configService)
    }
}

function createServiceWithConfig(values: Record<string, unknown>) {
    const configService = { get: (key: string) => values[key] } as unknown as ConfigService
    return new TestConfigService(configService)
}
