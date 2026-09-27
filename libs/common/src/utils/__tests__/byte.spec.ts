import { ByteUtil } from '../index.js'

describe('ByteUtil', () => {
    describe('fromString', () => {
        describe('입력이 "1024B"이면', () => {
            let input: string
            beforeEach(() => {
                input = '1024B'
            })
            it('바이트로 변환하면 1024를 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024)
            })
        })

        describe('입력이 "1KB"이면', () => {
            let input: string
            beforeEach(() => {
                input = '1KB'
            })
            it('바이트로 변환하면 1024를 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024)
            })
        })

        describe('입력이 "1MB"이면', () => {
            let input: string
            beforeEach(() => {
                input = '1MB'
            })
            it('바이트로 변환하면 1024의 제곱을 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024 * 1024)
            })
        })

        describe('입력이 "1GB"이면', () => {
            let input: string
            beforeEach(() => {
                input = '1GB'
            })
            it('바이트로 변환하면 1024의 세제곱을 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024 ** 3)
            })
        })

        describe('입력이 "1TB"이면', () => {
            let input: string
            beforeEach(() => {
                input = '1TB'
            })
            it('바이트로 변환하면 1024의 네제곱을 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024 ** 4)
            })
        })

        describe('여러 단위가 공백으로 구분되어 있으면', () => {
            let input: string
            beforeEach(() => {
                input = '1KB 512B'
            })
            it('바이트로 변환하면 각 단위의 값을 합산한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1536)
            })
        })

        describe('단위 앞의 값이 소수이면', () => {
            let input: string
            beforeEach(() => {
                input = '1.5KB'
            })
            it('바이트로 변환하면 소수 값을 반영한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1536)
            })
        })

        describe('단위 앞의 값이 음수이면', () => {
            let input: string
            beforeEach(() => {
                input = '-1KB'
            })
            it('바이트로 변환하면 음수를 반환한다', () => {
                expect(ByteUtil.fromString(input)).toBe(-1024)
            })
        })

        describe('GB·MB·KB가 함께 있으면', () => {
            let input: string
            beforeEach(() => {
                input = '1GB 256MB 128KB'
            })
            it('바이트로 변환하면 각 단위의 값을 합산한다', () => {
                expect(ByteUtil.fromString(input)).toBe(1024 ** 3 + 256 * 1024 ** 2 + 128 * 1024)
            })
        })

        describe.each([
            ['1kb', 1024],
            ['1mb', 1024 * 1024],
            ['1gb', 1024 ** 3]
        ] as const)('소문자 단위를 사용한 %s 문자열이면', (input, expected) => {
            let value: string
            beforeEach(() => {
                value = input
            })
            it('바이트로 변환하면 해당 단위의 값을 반환한다', () => {
                expect(ByteUtil.fromString(value)).toBe(expected)
            })
        })

        describe('유효하지 않은 형식', () => {
            describe('입력이 알 수 없는 단어이면', () => {
                let input: string
                beforeEach(() => {
                    input = 'invalid'
                })
                it('바이트로 변환하면 예외를 던진다', () => {
                    expect(() => ByteUtil.fromString(input)).toThrow()
                })
            })

            describe('입력에 숫자만 있고 단위가 없으면', () => {
                let input: string
                beforeEach(() => {
                    input = '123'
                })
                it('바이트로 변환하면 예외를 던진다', () => {
                    expect(() => ByteUtil.fromString(input)).toThrow()
                })
            })

            describe('입력에 지원하지 않는 단위가 있으면', () => {
                let input: string
                beforeEach(() => {
                    input = '123XB'
                })
                it('바이트로 변환하면 예외를 던진다', () => {
                    expect(() => ByteUtil.fromString(input)).toThrow()
                })
            })

            describe('입력이 불완전한 부호로 끝나면', () => {
                let input: string
                beforeEach(() => {
                    input = '1KB -'
                })
                it('바이트로 변환하면 예외를 던진다', () => {
                    expect(() => ByteUtil.fromString(input)).toThrow()
                })
            })

            describe('입력이 빈 문자열이면', () => {
                let input: string
                beforeEach(() => {
                    input = ''
                })
                it('바이트로 변환하면 예외를 던진다', () => {
                    expect(() => ByteUtil.fromString(input)).toThrow()
                })
            })
        })
    })

    describe('toString', () => {
        describe('바이트 수가 0이면', () => {
            let input: number
            beforeEach(() => {
                input = 0
            })
            it('문자열로 변환하면 "0B"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('0B')
            })
        })

        describe('바이트 수가 1024이면', () => {
            let input: number
            beforeEach(() => {
                input = 1024
            })
            it('문자열로 변환하면 "1KB"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('1KB')
            })
        })

        describe('바이트 수가 1024의 제곱이면', () => {
            let input: number
            beforeEach(() => {
                input = 1024 * 1024
            })
            it('문자열로 변환하면 "1MB"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('1MB')
            })
        })

        describe('바이트 수가 1536이면', () => {
            let input: number
            beforeEach(() => {
                input = 1536
            })
            it('문자열로 변환하면 "1KB 512B"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('1KB 512B')
            })

            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(ByteUtil.fromString(ByteUtil.toString(input))).toBe(1536)
            })
        })

        describe('바이트 수가 1.5MB에 해당하면', () => {
            let input: number
            beforeEach(() => {
                input = 1024 * 1024 * 1.5
            })
            it('문자열로 변환하면 "1MB 512KB"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('1MB 512KB')
            })

            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(ByteUtil.fromString(ByteUtil.toString(input))).toBe(1024 ** 2 * 1.5)
            })
        })

        describe('바이트 수가 -1024이면', () => {
            let input: number
            beforeEach(() => {
                input = -1024
            })
            it('문자열로 변환하면 "-1KB"를 반환한다', () => {
                expect(ByteUtil.toString(input)).toBe('-1KB')
            })
        })

        describe('바이트 수에 GB·MB·KB 단위의 나머지가 있으면', () => {
            let input: number
            beforeEach(() => {
                input = 1024 ** 3 + 256 * 1024 ** 2 + 128 * 1024
            })
            it('문자열로 변환하면 GB·MB·KB로 나누어 표시한다', () => {
                expect(ByteUtil.toString(input)).toBe('1GB 256MB 128KB')
            })

            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(ByteUtil.fromString(ByteUtil.toString(input))).toBe(
                    1024 ** 3 + 256 * 1024 ** 2 + 128 * 1024
                )
            })
        })

        describe('바이트 수가 -1536이면', () => {
            let input: number
            beforeEach(() => {
                input = -1536
            })
            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(ByteUtil.fromString(ByteUtil.toString(input))).toBe(-1536)
            })
        })

        describe.each([
            [0.5, '0.5B'],
            [-0.5, '-0.5B'],
            [1.5, '1.5B'],
            [-1.5, '-1.5B'],
            [1024.5, '1KB 0.5B'],
            [-1024.5, '-1KB -0.5B'],
            [1e-7, '1e-7B'],
            [-1e-7, '-1e-7B'],
            [Number.MIN_VALUE, '5e-324B']
        ] as const)('바이트 수가 소수 부분을 포함한 %s이면', (value, formatted) => {
            let bytes: number
            beforeEach(() => {
                bytes = value
            })
            it('문자열로 변환하면 소수 부분을 표시하고 다시 읽을 수 있다', () => {
                expect(ByteUtil.toString(bytes)).toBe(formatted)
                expect(ByteUtil.fromString(formatted)).toBe(value)
            })
        })
    })
})
