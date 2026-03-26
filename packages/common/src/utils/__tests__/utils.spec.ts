import { Env } from '../env'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        // 환경 변수가 제공될 때
        describe('when the env var is provided', () => {
            beforeEach(() => {
                process.env.TEST_STRING = 'hello'
            })

            // 값을 반환한다
            it('returns the value', () => {
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        // 환경 변수가 제공되지 않을 때
        describe('when the env var is not provided', () => {
            // 예외를 던진다
            it('throws', () => {
                expect(() => Env.getString('TEST_STRING')).toThrow(
                    'Environment variable TEST_STRING is not defined'
                )
            })
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        // 환경 변수가 숫자일 때
        describe('when the env var is numeric', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = '123'
            })

            // 숫자를 반환한다
            it('returns the number', () => {
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        // 환경 변수가 숫자가 아닐 때
        describe('when the env var is not numeric', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = 'abc'
            })

            // 예외를 던진다
            it('throws', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        // 환경 변수가 숫자로 끝나지 않을 때
        describe('when the env var contains a numeric prefix only', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = '123abc'
            })

            // 예외를 던진다
            it('throws', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        // 환경 변수가 제공되지 않을 때
        describe('when the env var is not provided', () => {
            // 예외를 던진다
            it('throws', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER is not defined'
                )
            })
        })
    })

    describe('getBoolean', () => {
        beforeEach(() => {
            delete process.env.TEST_BOOLEAN
        })

        // 환경 변수가 true일 때
        describe('when the env var is true', () => {
            beforeEach(() => {
                process.env.TEST_BOOLEAN = 'true'
            })

            // true를 반환한다
            it('returns true', () => {
                expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
            })
        })
    })
})
