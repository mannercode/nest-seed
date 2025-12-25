import { Byte } from 'common'

describe('Byte', () => {
    describe('fromString', () => {
        it.each([
            ['1024B', 1024],
            ['1KB', 1024],
            ['1MB', 1024 * 1024],
            ['1GB', 1024 * 1024 * 1024],
            ['1TB', 1024 * 1024 * 1024 * 1024],
            ['1KB 512B', 1536],
            ['1.5KB', 1536],
            ['-1KB', -1024],
            ['1GB 256MB 128KB', 1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024]
        ])('converts %s to bytes', (input, expected) => {
            expect(Byte.fromString(input)).toEqual(expected)
        })

        describe('when units are lowercase', () => {
            it.each([
                ['1024b', 1024],
                ['1kb', 1024],
                ['1mb', 1024 * 1024],
                ['1gb', 1024 * 1024 * 1024],
                ['1tb', 1024 * 1024 * 1024 * 1024]
            ])('converts %s to bytes', (input, expected) => {
                expect(Byte.fromString(input)).toEqual(expected)
            })
        })

        describe('when the format is invalid', () => {
            it.each(['invalid', '123', '123XB', '1KB -'])('throws Error', (input) => {
                expect(() => Byte.fromString(input)).toThrow()
            })
        })
    })

    describe('toString', () => {
        it.each([
            [0, '0B'],
            [1024, '1KB'],
            [1536, '1KB512B'],
            [1024 * 1024, '1MB'],
            [1024 * 1024 * 1.5, '1MB512KB'],
            [-1024, '-1KB'],
            [1 * 1024 * 1024 * 1024 + 256 * 1024 * 1024 + 128 * 1024, '1GB256MB128KB']
        ])('converts %s to a string', (input, expected) => {
            expect(Byte.toString(input)).toEqual(expected)
        })
    })
})
