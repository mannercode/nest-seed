import { Env } from '../index.js'

describe('Env', () => {
    afterEach(() => vi.unstubAllEnvs())

    describe('getString', () => {
        describe('환경 변수가 설정되어 있으면', () => {
            beforeEach(() => vi.stubEnv('TEST_STRING', 'hello'))

            it('조회하면 설정한 문자열을 반환한다', () => {
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        describe('환경 변수가 없으면', () => {
            beforeEach(() => vi.stubEnv('TEST_STRING', undefined))

            it('조회하면 환경 변수가 없다는 예외를 던진다', () => {
                expect(() => Env.getString('TEST_STRING')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_STRING is not defined'
                    })
                )
            })
        })
    })

    describe('getNumber', () => {
        describe('환경 변수에 숫자 문자열이 설정되어 있으면', () => {
            beforeEach(() => vi.stubEnv('TEST_NUMBER', '123'))

            it('조회하면 숫자로 변환해 반환한다', () => {
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe.each([
            { label: '일반 문자열', value: 'abc' },
            { label: '공백', value: ' ' },
            { label: '탭', value: '\t' },
            { label: 'NaN 문자열', value: 'NaN' },
            { label: 'Infinity 문자열', value: 'Infinity' },
            { label: '숫자로 시작하는 혼합 문자열', value: '123abc' }
        ])('환경 변수에 $label 값이 설정되어 있으면', ({ value }) => {
            beforeEach(() => vi.stubEnv('TEST_NUMBER', value))

            it('숫자로 조회하면 유효한 숫자가 아니라는 예외를 던진다', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_NUMBER must be a valid number'
                    })
                )
            })
        })

        describe('환경 변수가 없으면', () => {
            beforeEach(() => vi.stubEnv('TEST_NUMBER', undefined))

            it('조회하면 환경 변수가 없다는 예외를 던진다', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_NUMBER is not defined'
                    })
                )
            })
        })
    })

    describe('getBoolean', () => {
        describe.each([
            { value: 'true', expected: true },
            { value: 'TRUE', expected: true },
            { value: 'True', expected: true },
            { value: 'false', expected: false },
            { value: 'FALSE', expected: false }
        ])('환경 변수 값이 "$value"이면', ({ value, expected }) => {
            beforeEach(() => vi.stubEnv('TEST_BOOLEAN', value))

            it('조회하면 대소문자와 관계없이 불리언으로 변환한다', () => {
                expect(Env.getBoolean('TEST_BOOLEAN')).toBe(expected)
            })
        })

        describe.each([
            { label: '숫자 문자열', value: '1' },
            { label: 'yes', value: 'yes' },
            { label: 'tru', value: 'tru' },
            { label: 'truthy', value: 'truthy' },
            { label: '공백', value: ' ' }
        ])('환경 변수에 $label 값이 설정되어 있으면', ({ value }) => {
            beforeEach(() => vi.stubEnv('TEST_BOOLEAN', value))

            it('불리언으로 조회하면 true나 false가 아니라는 예외를 던진다', () => {
                expect(() => Env.getBoolean('TEST_BOOLEAN')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_BOOLEAN must be true or false'
                    })
                )
            })
        })

        describe('환경 변수 값이 빈 문자열이면', () => {
            beforeEach(() => vi.stubEnv('TEST_BOOLEAN', ''))

            it('조회하면 환경 변수가 없다는 예외를 던진다', () => {
                expect(() => Env.getBoolean('TEST_BOOLEAN')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_BOOLEAN is not defined'
                    })
                )
            })
        })
    })
})
