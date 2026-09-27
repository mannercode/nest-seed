import { InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    type BaseConfigServiceFixture,
    createBaseConfigServiceFixture
} from './base-config.service.fixture.js'
import { BaseConfigService } from '../index.js'

describe('BaseConfigService', () => {
    let fix: BaseConfigServiceFixture

    beforeEach(async () => {
        process.env['TEST_STRING_KEY'] = 'value'
        process.env['TEST_NUMBER_KEY'] = '123'
        process.env['TEST_NUMBER_ZERO_KEY'] = '0'
        process.env['TEST_BOOLEAN_KEY'] = 'true'
        process.env['TEST_BOOLEAN_FALSE_KEY'] = 'false'

        fix = await createBaseConfigServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('getString', () => {
        describe.each([
            { condition: '설정 값이 null이면', value: null },
            { condition: '설정 값이 숫자이면', value: 123 },
            { condition: '설정 값이 불리언이면', value: true },
            { condition: '설정 값이 배열이면', value: [] },
            { condition: '설정 값이 객체이면', value: {} }
        ])('$condition', ({ value }) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ S: value })
            })
            it('문자열로 조회하면 500 예외를 던진다', () => {
                expect(() => service.getString('S')).toThrow(
                    expect.objectContaining({ status: 500, cause: "Key 'S' is not a string" })
                )
            })
        })

        describe('환경 변수 값이 비어 있지 않은 문자열이면', () => {
            let key: string
            beforeEach(() => {
                key = 'TEST_STRING_KEY'
            })
            it('문자열로 조회하면 해당 값을 반환한다', () => {
                const result = fix.appConfigService.getString(key)
                expect(result).toBe('value')
            })
        })

        describe('설정에 요청한 키가 없으면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({})
            })
            it('문자열로 조회하면 키가 없다는 500 예외를 던진다', () => {
                expect(() => service.getString('SOME_KEY')).toThrow(
                    expect.objectContaining({ status: 500, cause: "Key 'SOME_KEY' is not defined" })
                )
            })
        })

        describe('설정 값이 빈 문자열이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ SOME_KEY: '' })
            })
            it('문자열로 조회하면 값이 없다는 500 예외를 던진다', () => {
                expect(() => service.getString('SOME_KEY')).toThrow(
                    expect.objectContaining({ status: 500, cause: "Key 'SOME_KEY' is not defined" })
                )
            })
        })
    })

    describe('getNumber', () => {
        describe.each([
            { condition: '설정 값이 null이면', value: null },
            { condition: '설정 값이 true이면', value: true },
            { condition: '설정 값이 false이면', value: false },
            { condition: '설정 값이 빈 배열이면', value: [] },
            { condition: '설정 값이 숫자가 든 배열이면', value: [123] },
            { condition: '설정 값이 객체이면', value: {} }
        ])('$condition', ({ value }) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ N: value })
            })
            it('숫자로 조회하면 500 예외를 던진다', () => {
                expect(() => service.getNumber('N')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: expect.stringContaining('not a finite number')
                    })
                )
            })
        })

        describe('설정 값이 유한한 수이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ N: 1.5 })
            })
            it('조회하면 값을 그대로 반환한다', () => {
                expect(service.getNumber('N')).toBe(1.5)
            })
        })

        describe('설정 값이 Infinity이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ BAD: Infinity })
            })
            it('숫자로 조회하면 예외를 던진다', () => {
                expect(() => service.getNumber('BAD')).toThrow(InternalServerErrorException)
            })
        })

        describe('환경 변수 값이 숫자 문자열이면', () => {
            let key: string
            beforeEach(() => {
                key = 'TEST_NUMBER_KEY'
            })
            it('숫자로 조회하면 숫자로 변환해 반환한다', () => {
                const result = fix.appConfigService.getNumber(key)
                expect(result).toBe(123)
            })
        })

        describe('환경 변수 값이 문자열 "0"이면', () => {
            let key: string
            beforeEach(() => {
                key = 'TEST_NUMBER_ZERO_KEY'
            })
            it('숫자로 조회하면 0을 반환한다', () => {
                const result = fix.appConfigService.getNumber(key)
                expect(result).toBe(0)
            })
        })

        describe('요청한 환경 변수가 없으면', () => {
            let key: string
            beforeEach(() => {
                key = 'not-exists-key'
            })
            it('숫자로 조회하면 예외를 던진다', () => {
                expect(() => fix.appConfigService.getNumber(key)).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: "Key 'not-exists-key' is not defined"
                    })
                )
            })
        })

        describe('설정 값이 숫자 문자열이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ N: '42' })
            })
            it('조회하면 숫자로 변환해 반환한다', () => {
                expect(service.getNumber('N')).toBe(42)
            })
        })

        describe('설정 값이 숫자로 변환할 수 없는 문자열이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ N: 'abc' })
            })
            it('숫자로 조회하면 유한한 수가 아니라는 500 예외를 던진다', () => {
                expect(() => service.getNumber('N')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: "Key 'N' is not a finite number: 'abc'"
                    })
                )
            })
        })

        describe('설정 값이 빈 문자열이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ N: '' })
            })
            it('숫자로 조회하면 500 예외를 던진다', () => {
                expect(() => service.getNumber('N')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: "Key 'N' is not a finite number: ''"
                    })
                )
            })
        })
    })

    describe('getBoolean', () => {
        describe.each([
            { condition: '설정 값이 null이면', value: null },
            { condition: '설정 값이 숫자이면', value: 1 },
            { condition: '설정 값이 배열이면', value: ['true'] },
            {
                condition: '설정 값이 문자열로 변환할 수 있는 객체이면',
                value: { toString: () => 'true' }
            }
        ])('$condition', ({ value }) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ B: value })
            })
            it('불리언으로 조회하면 예외를 던진다', () => {
                expect(() => service.getBoolean('B')).toThrow(InternalServerErrorException)
            })
        })

        describe.each([true, false])('설정 값이 불리언 %s이면', (value) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ B: value })
            })
            it('조회하면 불리언 값을 그대로 반환한다', () => {
                expect(service.getBoolean('B')).toBe(value)
            })
        })

        describe('환경 변수 값이 문자열 "true"이면', () => {
            let key: string
            beforeEach(() => {
                key = 'TEST_BOOLEAN_KEY'
            })
            it('불리언으로 조회하면 true를 반환한다', () => {
                const result = fix.appConfigService.getBoolean(key)
                expect(result).toBe(true)
            })
        })

        describe('환경 변수 값이 문자열 "false"이면', () => {
            let key: string
            beforeEach(() => {
                key = 'TEST_BOOLEAN_FALSE_KEY'
            })
            it('불리언으로 조회하면 false를 반환한다', () => {
                const result = fix.appConfigService.getBoolean(key)
                expect(result).toBe(false)
            })
        })

        describe('요청한 환경 변수가 없으면', () => {
            let key: string
            beforeEach(() => {
                key = 'not-exists-key'
            })
            it('불리언으로 조회하면 예외를 던진다', () => {
                expect(() => fix.appConfigService.getBoolean(key)).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: "Key 'not-exists-key' is not defined"
                    })
                )
            })
        })

        describe.each([
            { value: 'true', expected: true },
            { value: 'false', expected: false }
        ])('설정 값이 문자열 "$value"이면', ({ value, expected }) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ B: value })
            })
            it('조회하면 불리언으로 변환해 반환한다', () => {
                expect(service.getBoolean('B')).toBe(expected)
            })
        })

        describe.each([
            { label: '대문자와 앞뒤 공백이 있으면', value: '  TRUE  ', expected: true },
            { label: '대소문자가 섞여 있으면', value: 'False', expected: false }
        ])('설정 값에 $label', ({ value, expected }) => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ B: value })
            })
            it('조회하면 대소문자와 앞뒤 공백을 무시하고 불리언으로 변환한다', () => {
                expect(service.getBoolean('B')).toBe(expected)
            })
        })

        describe('설정 값이 "true"나 "false"가 아닌 문자열이면', () => {
            let service: BaseConfigService
            beforeEach(() => {
                service = createServiceWithConfig({ B: 'maybe' })
            })
            it('불리언으로 조회하면 500 예외를 던진다', () => {
                expect(() => service.getBoolean('B')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: "Key 'B' is not a boolean: 'maybe'"
                    })
                )
            })
        })
    })
})

class TestConfigService extends BaseConfigService {
    constructor(configService: ConfigService) {
        super(configService)
    }
}

function createServiceWithConfig(values: Record<string, unknown>) {
    return new TestConfigService(new ConfigService(values))
}
