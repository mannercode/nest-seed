import { Env } from 'common'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        describe('when the env var is provided', () => {
            it('returns the value', () => {
                process.env.TEST_STRING = 'hello'
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        describe('when the env var is not provided', () => {
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

        describe('when the env var is numeric', () => {
            it('returns the number', () => {
                process.env.TEST_NUMBER = '123'
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe('when the env var is not numeric', () => {
            it('throws', () => {
                process.env.TEST_NUMBER = 'abc'
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        describe('when the env var is not provided', () => {
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

        describe('when the env var is true', () => {
            it('returns true', () => {
                process.env.TEST_BOOLEAN = 'true'
                expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
            })
        })
    })

    describe('setValue', () => {
        describe('when setting a string value', () => {
            it('sets the value in process.env as-is', () => {
                Env.setValue('TEST_VALUE', 'value')

                expect(process.env.TEST_VALUE).toEqual('value')
            })
        })
    })
})
