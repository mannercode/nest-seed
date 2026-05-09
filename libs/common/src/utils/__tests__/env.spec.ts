import { Env } from '../env'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        describe('환경 변수가 제공될 때', () => {
            beforeEach(() => {
                process.env.TEST_STRING = 'hello'
            })

            it('값을 반환한다', () => {
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        describe('환경 변수가 제공되지 않을 때', () => {
            it('예외를 던진다', () => {
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

        describe('환경 변수가 숫자일 때', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = '123'
            })

            it('숫자를 반환한다', () => {
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe('환경 변수가 숫자가 아닐 때', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = 'abc'
            })

            it('예외를 던진다', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        describe('환경 변수가 숫자로 끝나지 않을 때', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = '123abc'
            })

            it('예외를 던진다', () => {
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        describe('환경 변수가 제공되지 않을 때', () => {
            it('예외를 던진다', () => {
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

        describe('환경 변수가 true일 때', () => {
            beforeEach(() => {
                process.env.TEST_BOOLEAN = 'true'
            })

            it('true를 반환한다', () => {
                expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
            })
        })
    })
})
