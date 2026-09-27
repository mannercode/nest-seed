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
            { label: 'null', value: null },
            { label: '숫자', value: 123 },
            { label: '불리언', value: true },
            { label: '배열', value: [] },
            { label: '객체', value: {} }
        ])('설정 값이 $label이면', ({ value }) => {
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

        it('키가 존재하면 문자열을 반환한다', () => {
            const result = fix.appConfigService.getString('TEST_STRING_KEY')
            expect(result).toBe('value')
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
            { label: 'null', value: null },
            { label: 'true', value: true },
            { label: 'false', value: false },
            { label: '빈 배열', value: [] },
            { label: '숫자가 든 배열', value: [123] },
            { label: '객체', value: {} }
        ])('설정 값이 $label이면', ({ value }) => {
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
                expect.objectContaining({
                    status: 500,
                    cause: "Key 'not-exists-key' is not defined"
                })
            )
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
            { label: 'null', value: null },
            { label: '숫자', value: 1 },
            { label: '배열', value: ['true'] },
            { label: '문자열로 변환할 수 있는 객체', value: { toString: () => 'true' } }
        ])('설정 값이 $label이면', ({ value }) => {
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
                expect.objectContaining({
                    status: 500,
                    cause: "Key 'not-exists-key' is not defined"
                })
            )
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
