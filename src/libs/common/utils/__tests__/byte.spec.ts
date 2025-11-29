import { Byte } from 'common'

describe('Byte', () => {
    describe('fromString', () => {
        describe('when the size string is valid', () => {
            it('converts to bytes', () => {
                expect(Byte.fromString('1024B')).toEqual(1024)
                expect(Byte.fromString('1KB')).toEqual(1024)
                expect(Byte.fromString('1MB')).toEqual(1024 * 1024)
                expect(Byte.fromString('1GB')).toEqual(1024 * 1024 * 1024)
                expect(Byte.fromString('1TB')).toEqual(1024 * 1024 * 1024 * 1024)
                expect(Byte.fromString('1KB 512B')).toEqual(1536)
                expect(Byte.fromString('1.5KB')).toEqual(1536)
                expect(Byte.fromString('-1KB')).toEqual(-1024)
                expect(Byte.fromString('1GB 256MB 128KB')).toEqual(
                    1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024
                )
            })
        })

        describe('when the unit string is lowercase', () => {
            it('converts lowercase units to bytes', () => {
                expect(Byte.fromString('1024b')).toEqual(1024)
                expect(Byte.fromString('1kb')).toEqual(1024)
                expect(Byte.fromString('1mb')).toEqual(1024 * 1024)
                expect(Byte.fromString('1gb')).toEqual(1024 * 1024 * 1024)
                expect(Byte.fromString('1tb')).toEqual(1024 * 1024 * 1024 * 1024)
            })
        })

        describe('when the format is invalid', () => {
            it('throws an error', () => {
                expect(() => Byte.fromString('invalid')).toThrow()
                expect(() => Byte.fromString('123')).toThrow()
                expect(() => Byte.fromString('123XB')).toThrow()
                expect(() => Byte.fromString('1KB -')).toThrow()
            })
        })
    })

    describe('toString', () => {
        describe('when converting byte values to a string', () => {
            it('returns a human-readable string', () => {
                expect(Byte.toString(0)).toEqual('0B')
                expect(Byte.toString(1024)).toEqual('1KB')
                expect(Byte.toString(1536)).toEqual('1KB512B')
                expect(Byte.toString(1024 * 1024)).toEqual('1MB')
                expect(Byte.toString(1024 * 1024 * 1.5)).toEqual('1MB512KB')
                expect(Byte.toString(-1024)).toEqual('-1KB')
                expect(
                    Byte.toString(1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024)
                ).toEqual('1GB256MB128KB')
            })
        })
    })
})
