import type { MockInstance } from 'vitest'
import { Logger } from '@nestjs/common'
import { Assume, ensure, Require } from '../index.js'

describe('Require', () => {
    describe('defined', () => {
        describe('값이 null이면', () => {
            let first: Parameters<typeof Require.defined>[0]
            beforeEach(() => {
                first = null
            })
            it('필수 값을 확인하면 예외를 던진다', () => {
                expect(() => Require.defined(first)).toThrow(
                    expect.objectContaining({ status: 500, cause: 'Value must exist.' })
                )
            })
        })

        describe('값이 undefined이면', () => {
            let first: Parameters<typeof Require.defined>[0]
            beforeEach(() => {
                first = undefined
            })
            it('필수 값을 확인하면 예외를 던진다', () => {
                expect(() => Require.defined(first)).toThrow(
                    expect.objectContaining({ status: 500, cause: 'Value must exist.' })
                )
            })
        })

        describe('값이 비어 있지 않은 문자열이면', () => {
            let value: string
            beforeEach(() => {
                value = 'value'
            })
            it('필수 값을 확인하면 예외 없이 통과한다', () => {
                expect(() => Require.defined(value)).not.toThrow()
            })
        })
    })

    describe('equalLength', () => {
        describe('두 배열의 길이가 다르면', () => {
            let first: Parameters<typeof Require.equalLength>[0]
            let second: Parameters<typeof Require.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = [1, 2]
            })
            it('배열 길이를 비교하면 예외를 던진다', () => {
                expect(() => Require.equalLength(first, second, 'mismatch')).toThrow(
                    expect.objectContaining({ status: 500, cause: 'mismatch first: 1, second: 2' })
                )
            })
        })

        describe('첫 번째 배열이 undefined이면', () => {
            let first: Parameters<typeof Require.equalLength>[0]
            let second: Parameters<typeof Require.equalLength>[1]
            beforeEach(() => {
                first = undefined

                second = [1]
            })
            it('배열 길이를 비교하면 예외를 던진다', () => {
                expect(() => Require.equalLength(first, second, 'mismatch')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: expect.stringMatching(/mismatch first: undefined, second: 1/)
                    })
                )
            })
        })

        describe('두 번째 배열이 undefined이면', () => {
            let first: Parameters<typeof Require.equalLength>[0]
            let second: Parameters<typeof Require.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = undefined
            })
            it('배열 길이를 비교하면 예외를 던진다', () => {
                expect(() => Require.equalLength(first, second, 'mismatch')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: expect.stringMatching(/mismatch first: 1, second: undefined/)
                    })
                )
            })
        })

        describe('두 배열의 길이가 같으면', () => {
            let first: Parameters<typeof Require.equalLength>[0]
            let second: Parameters<typeof Require.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = [2]
            })
            it('배열 길이를 비교하면 통과한다', () => {
                expect(() => Require.equalLength(first, second, 'mismatch')).not.toThrow()
            })
        })
    })

    describe('equals', () => {
        describe('값이 다르면', () => {
            let first: Parameters<typeof Require.equals>[0]
            let second: Parameters<typeof Require.equals>[1]
            beforeEach(() => {
                first = 1

                second = 2
            })
            it('값을 비교하면 예외를 던진다', () => {
                expect(() => Require.equals(first, second, 'not equal')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: expect.stringMatching(/1 !== 2, not equal/)
                    })
                )
            })
        })

        describe('값이 같으면', () => {
            let first: Parameters<typeof Require.equals>[0]
            let second: Parameters<typeof Require.equals>[1]
            beforeEach(() => {
                first = 1

                second = 1
            })
            it('값을 비교하면 통과한다', () => {
                expect(() => Require.equals(first, second, 'not equal')).not.toThrow()
            })
        })

        describe('두 BigInt 값이 다르면', () => {
            let first: Parameters<typeof Require.equals>[0]
            let second: Parameters<typeof Require.equals>[1]
            beforeEach(() => {
                first = 1n

                second = 2n
            })
            it('값을 비교하면 두 값과 원인 메시지를 담은 500 예외를 던진다', () => {
                expect(() => Require.equals(first, second, 'bigint mismatch')).toThrow(
                    expect.objectContaining({ status: 500, cause: '1n !== 2n, bigint mismatch' })
                )
            })
        })

        describe('두 순환 객체의 값이 다르면', () => {
            let first: any
            let second: any
            beforeEach(() => {
                first = { value: 1 }
                first.self = first
                second = { value: 2 }
                second.self = second
            })
            it('값을 비교하면 순환 참조 표시와 원인 메시지를 담은 500 예외를 던진다', () => {
                expect(() => Require.equals(first, second, 'cycle mismatch')).toThrow(
                    expect.objectContaining({
                        status: 500,
                        cause: expect.stringMatching(/Circular.*!==.*Circular.*cycle mismatch/)
                    })
                )
            })
        })
    })
})

describe('Assume', () => {
    describe('equalLength', () => {
        let warnSpy: MockInstance

        beforeEach(() => {
            warnSpy = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined)
        })

        describe('두 배열의 길이가 다르면', () => {
            let first: Parameters<typeof Assume.equalLength>[0]
            let second: Parameters<typeof Assume.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = [1, 2]
            })
            it('배열 길이를 비교하면 Logger.warn을 호출한다', () => {
                Assume.equalLength(first, second, 'mismatch')

                expect(warnSpy).toHaveBeenCalledWith('mismatch first: 1, second: 2')
            })
        })

        describe('첫 번째 배열이 undefined이면', () => {
            let first: Parameters<typeof Assume.equalLength>[0]
            let second: Parameters<typeof Assume.equalLength>[1]
            beforeEach(() => {
                first = undefined

                second = [1]
            })
            it('배열 길이를 비교하면 Logger.warn을 호출한다', () => {
                Assume.equalLength(first, second, 'mismatch')

                expect(warnSpy).toHaveBeenCalledWith('mismatch first: undefined, second: 1')
            })
        })

        describe('두 번째 배열이 undefined이면', () => {
            let first: Parameters<typeof Assume.equalLength>[0]
            let second: Parameters<typeof Assume.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = undefined
            })
            it('배열 길이를 비교하면 Logger.warn을 호출한다', () => {
                Assume.equalLength(first, second, 'mismatch')

                expect(warnSpy).toHaveBeenCalledWith('mismatch first: 1, second: undefined')
            })
        })

        describe('두 배열의 길이가 같으면', () => {
            let first: Parameters<typeof Assume.equalLength>[0]
            let second: Parameters<typeof Assume.equalLength>[1]
            beforeEach(() => {
                first = [1]

                second = [2]
            })
            it('배열 길이를 비교하면 Logger.warn을 호출하지 않는다', () => {
                Assume.equalLength(first, second, 'mismatch')

                expect(warnSpy).not.toHaveBeenCalled()
            })
        })
    })
})

describe('ensure', () => {
    describe('값이 null이면', () => {
        let first: Parameters<typeof ensure>[0]
        beforeEach(() => {
            first = null
        })
        it('필수 값을 확인하면 예외를 던진다', () => {
            expect(() => ensure(first)).toThrow(
                expect.objectContaining({ status: 500, cause: 'Value must exist.' })
            )
        })
    })

    describe('값이 비어 있지 않은 문자열이면', () => {
        let value: string
        beforeEach(() => {
            value = 'hello'
        })
        it('필수 값을 확인하면 원래 값을 반환한다', () => {
            expect(ensure(value)).toBe('hello')
        })
    })

    describe.each([0, false, ''])('값이 %j이면', (value) => {
        let input: typeof value
        beforeEach(() => {
            input = value
        })
        it('필수 값을 확인하면 원래 값을 반환한다', () => {
            expect(ensure(input)).toBe(value)
        })
    })
    describe('값이 undefined이면', () => {
        let first: Parameters<typeof ensure>[0]
        beforeEach(() => {
            first = undefined
        })
        it('필수 값을 확인하면 예외를 던진다', () => {
            expect(() => ensure(first)).toThrow(
                expect.objectContaining({ status: 500, cause: 'Value must exist.' })
            )
        })
    })
})
