import { ByteUtil } from '../byte'

describe('ByteUtil', () => {
    describe('fromString', () => {
        it('"1024B"는 1024를 반환한다', () => {
            expect(ByteUtil.fromString('1024B')).toBe(1024)
        })

        it('1KB는 1024를 반환한다', () => {
            expect(ByteUtil.fromString('1KB')).toBe(1024)
        })

        it('1MB는 1024^2를 반환한다', () => {
            expect(ByteUtil.fromString('1MB')).toBe(1024 * 1024)
        })

        it('1GB는 1024^3을 반환한다', () => {
            expect(ByteUtil.fromString('1GB')).toBe(1024 ** 3)
        })

        it('1TB는 1024^4를 반환한다', () => {
            expect(ByteUtil.fromString('1TB')).toBe(1024 ** 4)
        })

        it('여러 단위를 공백으로 구분해 합산한다', () => {
            expect(ByteUtil.fromString('1KB 512B')).toBe(1536)
        })

        it('소수점 단위도 허용한다', () => {
            expect(ByteUtil.fromString('1.5KB')).toBe(1536)
        })

        it('음수 단위도 허용한다', () => {
            expect(ByteUtil.fromString('-1KB')).toBe(-1024)
        })

        it('GB/MB/KB가 섞여 있어도 합산한다', () => {
            expect(ByteUtil.fromString('1GB 256MB 128KB')).toBe(
                1024 ** 3 + 256 * 1024 ** 2 + 128 * 1024
            )
        })

        it('소문자 단위도 인식한다', () => {
            expect(ByteUtil.fromString('1kb')).toBe(1024)
            expect(ByteUtil.fromString('1mb')).toBe(1024 * 1024)
            expect(ByteUtil.fromString('1gb')).toBe(1024 ** 3)
        })

        describe('형식이 유효하지 않을 때', () => {
            it('알 수 없는 단어는 예외를 던진다', () => {
                expect(() => ByteUtil.fromString('invalid')).toThrow()
            })

            it('단위 없는 숫자는 예외를 던진다', () => {
                expect(() => ByteUtil.fromString('123')).toThrow()
            })

            it('정의되지 않은 단위는 예외를 던진다', () => {
                expect(() => ByteUtil.fromString('123XB')).toThrow()
            })

            it('형식이 깨진 입력은 예외를 던진다', () => {
                expect(() => ByteUtil.fromString('1KB -')).toThrow()
            })

            it('빈 문자열은 예외를 던진다', () => {
                expect(() => ByteUtil.fromString('')).toThrow()
            })
        })
    })

    describe('toString', () => {
        it('0은 "0B"를 반환한다', () => {
            expect(ByteUtil.toString(0)).toBe('0B')
        })

        it('1024는 "1KB"를 반환한다', () => {
            expect(ByteUtil.toString(1024)).toBe('1KB')
        })

        it('1024 * 1024는 "1MB"를 반환한다', () => {
            expect(ByteUtil.toString(1024 * 1024)).toBe('1MB')
        })

        it('1536은 "1KB512B"로 분할 표시한다', () => {
            expect(ByteUtil.toString(1536)).toBe('1KB512B')
        })

        it('1024 * 1024 * 1.5는 "1MB512KB"로 분할 표시한다', () => {
            expect(ByteUtil.toString(1024 * 1024 * 1.5)).toBe('1MB512KB')
        })

        it('-1024는 "-1KB"를 반환한다', () => {
            expect(ByteUtil.toString(-1024)).toBe('-1KB')
        })

        it('큰 값도 GB/MB/KB로 분할 표시한다', () => {
            expect(ByteUtil.toString(1024 ** 3 + 256 * 1024 ** 2 + 128 * 1024)).toBe(
                '1GB256MB128KB'
            )
        })
    })
})
