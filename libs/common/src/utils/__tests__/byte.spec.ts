import { ByteUtil } from '../byte'

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
        ])('%s를 바이트로 변환한다', (input, expected) => {
            expect(ByteUtil.fromString(input)).toEqual(expected)
        })

        describe('단위가 소문자일 때', () => {
            it.each([
                ['1024b', 1024],
                ['1kb', 1024],
                ['1mb', 1024 * 1024],
                ['1gb', 1024 * 1024 * 1024],
                ['1tb', 1024 * 1024 * 1024 * 1024]
            ])('%s를 바이트로 변환한다', (input, expected) => {
                expect(ByteUtil.fromString(input)).toEqual(expected)
            })
        })

        describe('형식이 유효하지 않을 때', () => {
            it.each(['invalid', '123', '123XB', '1KB -'])('Error를 던진다', (input) => {
                expect(() => ByteUtil.fromString(input)).toThrow()
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
        ])('%s를 문자열로 변환한다', (input, expected) => {
            expect(ByteUtil.toString(input)).toEqual(expected)
        })
    })
})
