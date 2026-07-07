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
            const service = createServiceWithConfig({})

            expect(() => service.getString('SOME_KEY')).toThrow("Key 'SOME_KEY' is not defined")
        })

        it('환경변수 값이 빈 문자열이면 예외를 던진다', () => {
            const service = createServiceWithConfig({ SOME_KEY: '' })

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

        it('ConfigService가 숫자 문자열을 그대로 넘겨도 숫자로 변환한다', () => {
            const service = createServiceWithConfig({ N: '42' })
            expect(service.getNumber('N')).toBe(42)
        })

        it('숫자가 아닌 문자열이면 finite-number 메시지로 예외를 던진다', () => {
            const service = createServiceWithConfig({ N: 'abc' })
            expect(() => service.getNumber('N')).toThrow("Key 'N' is not a finite number: 'abc'")
        })

        it('빈 문자열은 0으로 통과하지 않고 예외를 던진다', () => {
            const service = createServiceWithConfig({ N: '' })
            expect(() => service.getNumber('N')).toThrow("Key 'N' is not a finite number: ''")
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

        it('ConfigService가 "true"와 "false"를 그대로 넘겨도 불리언으로 변환한다', () => {
            const service = createServiceWithConfig({ T: 'true', F: 'false' })
            expect(service.getBoolean('T')).toBe(true)
            expect(service.getBoolean('F')).toBe(false)
        })

        it('대소문자와 앞뒤 공백이 달라도 변환한다', () => {
            const service = createServiceWithConfig({ T: '  TRUE  ', F: 'False' })
            expect(service.getBoolean('T')).toBe(true)
            expect(service.getBoolean('F')).toBe(false)
        })

        it('"true"나 "false"가 아닌 문자열이면 boolean 메시지로 예외를 던진다', () => {
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
