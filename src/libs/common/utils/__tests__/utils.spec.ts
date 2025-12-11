import { Env } from 'common'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        describe('when the env var exists', () => {
            it('returns the value', () => {
                process.env.TEST_STRING = 'hello'
                expect(Env.getString('TEST_STRING')).toBe('hello')
            })
        })

        describe('when the env var is missing', () => {
            it('throws an error', () => {
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

        describe('when the value is numeric', () => {
            it('returns the converted number', () => {
                process.env.TEST_NUMBER = '123'
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe('when the value is not numeric', () => {
            it('throws an error', () => {
                process.env.TEST_NUMBER = 'abc'
                expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                    'Environment variable TEST_NUMBER must be a valid number'
                )
            })
        })

        describe('when the env var is missing', () => {
            it('throws an error', () => {
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

        describe('when the value is boolean', () => {
            it('returns the converted boolean', () => {
                process.env.TEST_BOOLEAN = 'true'
                expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
            })
        })
    })

    describe('setValue', () => {
        describe('when the value is string', () => {
            it('sets the value to process.env as-is', () => {
                Env.setValue('TEST_VALUE', 'value')

                expect(process.env.TEST_VALUE).toEqual('value')
            })
        })
    })
})
