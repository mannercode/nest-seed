import { Env } from '../index.js'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        it('환경 변수 값을 반환한다', () => {
            process.env.TEST_STRING = 'hello'
            expect(Env.getString('TEST_STRING')).toBe('hello')
        })

        it('환경 변수가 없으면 예외를 던진다', () => {
            expect(() => Env.getString('TEST_STRING')).toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Environment variable TEST_STRING is not defined'
                })
            )
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        it('숫자 문자열을 숫자로 변환한다', () => {
            process.env.TEST_NUMBER = '123'
            expect(Env.getNumber('TEST_NUMBER')).toBe(123)
        })

        it.each(['abc', ' ', '\t', 'NaN', 'Infinity'])(
            '숫자가 아닌 %j이면 예외를 던진다',
            (value) => {
                process.env.TEST_NUMBER = value
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_NUMBER must be a valid number'
                    })
                )
            }
        )

        it('숫자로 시작하지만 뒤가 다르면 예외를 던진다', () => {
            process.env.TEST_NUMBER = '123abc'
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Environment variable TEST_NUMBER must be a valid number'
                })
            )
        })

        it('환경 변수가 없으면 예외를 던진다', () => {
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Environment variable TEST_NUMBER is not defined'
                })
            )
        })
    })

    describe('getBoolean', () => {
        beforeEach(() => {
            delete process.env.TEST_BOOLEAN
        })

        it('"true"이면 true를 반환한다', () => {
            process.env.TEST_BOOLEAN = 'true'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
        })

        it('대소문자 변형(TRUE, True)도 true로 처리한다', () => {
            process.env.TEST_BOOLEAN = 'TRUE'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)

            process.env.TEST_BOOLEAN = 'True'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
        })

        it('대소문자와 관계없이 false를 읽는다', () => {
            process.env.TEST_BOOLEAN = 'false'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(false)
            process.env.TEST_BOOLEAN = 'FALSE'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(false)
        })

        it.each(['1', 'yes', 'tru', 'truthy', ' '])(
            '불리언이 아닌 %j이면 예외를 던진다',
            (value) => {
                process.env.TEST_BOOLEAN = value
                expect(() => Env.getBoolean('TEST_BOOLEAN')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: 'Environment variable TEST_BOOLEAN must be true or false'
                    })
                )
            }
        )

        it('빈 문자열로 설정하면 미정의로 취급해 예외를 던진다', () => {
            process.env.TEST_BOOLEAN = ''
            expect(() => Env.getBoolean('TEST_BOOLEAN')).toThrow(
                expect.objectContaining({
                    status: 500,
                    cause: 'Environment variable TEST_BOOLEAN is not defined'
                })
            )
        })
    })
})
