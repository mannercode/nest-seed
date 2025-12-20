import { Env } from 'common'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        describe('when the env var is provided', () => {
            beforeEach(() => {
                process.env.TEST_STRING = 'hello'
            })

            it('returns the value', () => {
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
            beforeEach(() => {
                process.env.TEST_NUMBER = '123'
            })

            it('returns the number', () => {
                expect(Env.getNumber('TEST_NUMBER')).toBe(123)
            })
        })

        describe('when the env var is not numeric', () => {
            beforeEach(() => {
                process.env.TEST_NUMBER = 'abc'
            })

            it('throws', () => {
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
            beforeEach(() => {
                process.env.TEST_BOOLEAN = 'true'
            })

            it('returns true', () => {
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
