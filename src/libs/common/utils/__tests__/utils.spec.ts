import { Env } from 'common'

describe('Env', () => {
    describe('getString', () => {
        beforeEach(() => {
            delete process.env.TEST_STRING
        })

        it('returns the value for an existing env var', () => {
            process.env.TEST_STRING = 'hello'
            expect(Env.getString('TEST_STRING')).toBe('hello')
        })

        it('throws for a missing env var', () => {
            expect(() => Env.getString('TEST_STRING')).toThrow(
                'Environment variable TEST_STRING is not defined'
            )
        })
    })

    describe('getNumber', () => {
        beforeEach(() => {
            delete process.env.TEST_NUMBER
        })

        it('returns the converted number for a numeric value', () => {
            process.env.TEST_NUMBER = '123'
            expect(Env.getNumber('TEST_NUMBER')).toBe(123)
        })

        it('throws for a non-numeric value', () => {
            process.env.TEST_NUMBER = 'abc'
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER must be a valid number'
            )
        })

        it('throws for a missing env var', () => {
            expect(() => Env.getNumber('TEST_NUMBER')).toThrow(
                'Environment variable TEST_NUMBER is not defined'
            )
        })
    })

    describe('getBoolean', () => {
        beforeEach(() => {
            delete process.env.TEST_BOOLEAN
        })

        it('returns the converted boolean for a boolean value', () => {
            process.env.TEST_BOOLEAN = 'true'
            expect(Env.getBoolean('TEST_BOOLEAN')).toBe(true)
        })
    })

    describe('setValue', () => {
        it('sets a string value in process.env as-is', () => {
            Env.setValue('TEST_VALUE', 'value')

            expect(process.env.TEST_VALUE).toEqual('value')
        })
    })
})
