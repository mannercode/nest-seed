import { Logger } from '@nestjs/common'
import { Assume, ensure, Require } from '../validator'

describe('Require', () => {
    describe('defined', () => {
        describe('값이 null일 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.defined(null)).toThrow('Value must exist.')
            })
        })

        describe('값이 undefined일 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.defined(undefined)).toThrow('Value must exist.')
            })
        })

        describe('값이 존재할 때', () => {
            it('예외를 던지지 않는다', () => {
                expect(() => Require.defined('value')).not.toThrow()
            })
        })
    })

    describe('equalLength', () => {
        describe('두 배열의 길이가 다를 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.equalLength([1], [1, 2], 'mismatch')).toThrow(
                    'mismatch first: 1, second: 2'
                )
            })
        })

        describe('첫 번째 배열이 undefined일 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.equalLength(undefined, [1], 'mismatch')).toThrow()
            })
        })

        describe('두 번째 배열이 undefined일 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.equalLength([1], undefined, 'mismatch')).toThrow()
            })
        })

        describe('두 배열의 길이가 같을 때', () => {
            it('예외를 던지지 않는다', () => {
                expect(() => Require.equalLength([1], [2], 'mismatch')).not.toThrow()
            })
        })
    })

    describe('equals', () => {
        describe('값이 다를 때', () => {
            it('예외를 던진다', () => {
                expect(() => Require.equals(1, 2, 'not equal')).toThrow()
            })
        })

        describe('값이 같을 때', () => {
            it('예외를 던지지 않는다', () => {
                expect(() => Require.equals(1, 1, 'not equal')).not.toThrow()
            })
        })
    })
})

describe('Assume', () => {
    describe('equalLength', () => {
        describe('두 배열의 길이가 다를 때', () => {
            it('Logger.warn을 호출한다', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Assume.equalLength([1], [1, 2], 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: 1, second: 2')
            })
        })

        describe('첫 번째 배열이 undefined일 때', () => {
            it('Logger.warn을 호출한다', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Assume.equalLength(undefined, [1], 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: undefined, second: 1')
            })
        })

        describe('두 번째 배열이 undefined일 때', () => {
            it('Logger.warn을 호출한다', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Assume.equalLength([1], undefined, 'mismatch')

                expect(spy).toHaveBeenCalledWith('mismatch first: 1, second: undefined')
            })
        })

        describe('두 배열의 길이가 같을 때', () => {
            it('Logger.warn을 호출하지 않는다', () => {
                const spy = jest.spyOn(Logger, 'warn').mockImplementation()

                Assume.equalLength([1], [2], 'mismatch')

                expect(spy).not.toHaveBeenCalled()
            })
        })
    })
})

describe('ensure', () => {
    describe('값이 null일 때', () => {
        it('예외를 던진다', () => {
            expect(() => ensure(null)).toThrow('Value must exist.')
        })
    })

    describe('값이 존재할 때', () => {
        it('값을 반환한다', () => {
            expect(ensure('hello')).toBe('hello')
        })
    })

    it.todo(
        'ensure 가 0/false/"" 는 그대로 통과시키고 null/undefined 만 throw 한다 (== null 의 정확한 의미 lock-down)'
    )
})
