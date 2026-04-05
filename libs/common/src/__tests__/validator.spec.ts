import { Logger } from '@nestjs/common'
import { ensure, Require, Verify } from '../validator'

describe('Require', () => {
    describe('defined', () => {
        // 값이 null일 때
        describe('when the value is null', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.defined(null)).toThrow('Value must exist.')
            })
        })

        // 값이 undefined일 때
        describe('when the value is undefined', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.defined(undefined)).toThrow('Value must exist.')
            })
        })

        // 값이 존재할 때
        describe('when the value exists', () => {
            // 예외를 던지지 않는다
            it('does not throw', () => {
                expect(() => Require.defined('value')).not.toThrow()
            })
        })
    })

    describe('equalLength', () => {
        // 두 배열의 길이가 다를 때
        describe('when the arrays have different lengths', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.equalLength([1], [1, 2], 'mismatch')).toThrow(
                    'mismatch first: 1, second: 2'
                )
            })
        })

        // 첫 번째 배열이 undefined일 때
        describe('when the first array is undefined', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.equalLength(undefined, [1], 'mismatch')).toThrow()
            })
        })

        // 두 번째 배열이 undefined일 때
        describe('when the second array is undefined', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.equalLength([1], undefined, 'mismatch')).toThrow()
            })
        })

        // 두 배열의 길이가 같을 때
        describe('when the arrays have the same length', () => {
            // 예외를 던지지 않는다
            it('does not throw', () => {
                expect(() => Require.equalLength([1], [2], 'mismatch')).not.toThrow()
            })
        })
    })

    describe('equals', () => {
        // 값이 다를 때
        describe('when the values are different', () => {
            // 예외를 던진다
            it('throws an error', () => {
                expect(() => Require.equals(1, 2, 'not equal')).toThrow()
            })
        })

        // 값이 같을 때
        describe('when the values are equal', () => {
            // 예외를 던지지 않는다
            it('does not throw', () => {
                expect(() => Require.equals(1, 1, 'not equal')).not.toThrow()
            })
        })
    })
})

describe('Verify', () => {
    describe('equalLength', () => {
        // 두 배열의 길이가 다를 때
        describe('when the arrays have different lengths', () => {
            // Logger.warn을 호출한다
            it('logs a warning', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Verify.equalLength([1], [1, 2], 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: 1, second: 2')
            })
        })

        // 첫 번째 배열이 undefined일 때
        describe('when the first array is undefined', () => {
            // Logger.warn을 호출한다
            it('logs a warning', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Verify.equalLength(undefined, [1], 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: undefined, second: 1')
            })
        })

        // 두 번째 배열이 undefined일 때
        describe('when the second array is undefined', () => {
            // Logger.warn을 호출한다
            it('logs a warning', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Verify.equalLength([1], undefined, 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: 1, second: undefined')
            })
        })

        // 두 배열의 길이가 같을 때
        describe('when the arrays have the same length', () => {
            // Logger.warn을 호출하지 않는다
            it('does not log', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Verify.equalLength([1], [2], 'mismatch')

                expect(spy).not.toHaveBeenCalled()
            })
        })
    })
})

describe('ensure', () => {
    // 값이 null일 때
    describe('when the value is null', () => {
        // 예외를 던진다
        it('throws an error', () => {
            expect(() => ensure(null)).toThrow('Value must exist.')
        })
    })

    // 값이 존재할 때
    describe('when the value exists', () => {
        // 값을 반환한다
        it('returns the value', () => {
            expect(ensure('hello')).toBe('hello')
        })
    })
})
