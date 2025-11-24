import { Byte } from 'common'

describe('Byte', () => {
    describe('fromString', () => {
        // 유효한 크기 문자열인 경우
        describe('when the size string is valid', () => {
            // 바이트 숫자로 변환한다
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

        // 소문자 단위 문자열인 경우
        describe('when the unit string is lowercase', () => {
            // 바이트 숫자로 변환한다
            it('converts lowercase units to bytes', () => {
                expect(Byte.fromString('1024b')).toEqual(1024)
                expect(Byte.fromString('1kb')).toEqual(1024)
                expect(Byte.fromString('1mb')).toEqual(1024 * 1024)
                expect(Byte.fromString('1gb')).toEqual(1024 * 1024 * 1024)
                expect(Byte.fromString('1tb')).toEqual(1024 * 1024 * 1024 * 1024)
            })
        })

        // 형식이 잘못된 경우
        describe('when the format is invalid', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Byte.fromString('invalid')).toThrow()
                expect(() => Byte.fromString('123')).toThrow()
                expect(() => Byte.fromString('123XB')).toThrow()
                expect(() => Byte.fromString('1KB -')).toThrow()
            })
        })
    })

    describe('toString', () => {
        // 바이트 값을 문자열로 변환하는 경우
        describe('when converting byte values to a string', () => {
            // 사람이 읽기 쉬운 문자열을 반환한다
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
