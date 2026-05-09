import { Env } from '../env'

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
                'Environment variable TEST_STRING is not defined'
            )
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        it('숫자 문자열을 number로 변환한다', () => {
            process.env.TEST_NUMBER = '123'
            expect(Env.getNumber('TEST_NUMBER')).toBe(123)
        })

        it('숫자가 아닌 값이면 예외를 던진다', () => {
            process.env.TEST_NUMBER = 'abc'
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        it('숫자로 시작하지만 뒤가 다르면 예외를 던진다', () => {
            process.env.TEST_NUMBER = '123abc'
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        it('환경 변수가 없으면 예외를 던진다', () => {
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER is not defined'
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

        it('"true"가 아닌 모든 값은 false로 처리한다', () => {
            process.env.TEST_BOOLEAN = '1'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(false)

            process.env.TEST_BOOLEAN = 'yes'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(false)

            process.env.TEST_BOOLEAN = 'truthy'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(false)
        })
    })
})
