import { Logger } from '@nestjs/common'
import { Assume, ensure, Require } from '../validator'

describe('Require', () => {
    describe('defined', () => {
        it('값이 null이면 예외를 던진다', () => {
            expect(() => Require.defined(null)).toThrow('Value must exist.')
        })

        it('값이 undefined이면 예외를 던진다', () => {
            expect(() => Require.defined(undefined)).toThrow('Value must exist.')
        })

        it('값이 존재하면 통과한다', () => {
            expect(() => Require.defined('value')).not.toThrow()
        })
    })

    describe('equalLength', () => {
        it('두 배열의 길이가 다르면 예외를 던진다', () => {
            expect(() => Require.equalLength([1], [1, 2], 'mismatch')).toThrow(
                'mismatch first: 1, second: 2'
            )
        })

        it('첫 번째 배열이 undefined이면 예외를 던진다', () => {
            expect(() => Require.equalLength(undefined, [1], 'mismatch')).toThrow(
                /mismatch first: undefined, second: 1/
            )
        })

        it('두 번째 배열이 undefined이면 예외를 던진다', () => {
            expect(() => Require.equalLength([1], undefined, 'mismatch')).toThrow(
                /mismatch first: 1, second: undefined/
            )
        })

        it('두 배열의 길이가 같으면 통과한다', () => {
            expect(() => Require.equalLength([1], [2], 'mismatch')).not.toThrow()
        })
    })

    describe('equals', () => {
        it('값이 다르면 예외를 던진다', () => {
            expect(() => Require.equals(1, 2, 'not equal')).toThrow(/1 !== 2, not equal/)
        })

        it('값이 같으면 통과한다', () => {
            expect(() => Require.equals(1, 1, 'not equal')).not.toThrow()
        })
    })
})

describe('Assume', () => {
    describe('equalLength', () => {
        let warnSpy: jest.SpyInstance

        beforeEach(() => {
            warnSpy = jest.spyOn(Logger, 'warn').mockImplementation()
        })

        it('두 배열의 길이가 다르면 Logger.warn을 호출한다', () => {
            Assume.equalLength([1], [1, 2], 'mismatch')

            expect(warnSpy).toHaveBeenCalledWith('mismatch first: 1, second: 2')
        })

        it('첫 번째 배열이 undefined이면 Logger.warn을 호출한다', () => {
            Assume.equalLength(undefined, [1], 'mismatch')

            expect(warnSpy).toHaveBeenCalledWith('mismatch first: undefined, second: 1')
        })

        it('두 번째 배열이 undefined이면 Logger.warn을 호출한다', () => {
            Assume.equalLength([1], undefined, 'mismatch')

            expect(warnSpy).toHaveBeenCalledWith('mismatch first: 1, second: undefined')
        })

        it('두 배열의 길이가 같으면 Logger.warn을 호출하지 않는다', () => {
            Assume.equalLength([1], [2], 'mismatch')

            expect(warnSpy).not.toHaveBeenCalled()
        })
    })
})

describe('ensure', () => {
    it('값이 null이면 예외를 던진다', () => {
        expect(() => ensure(null)).toThrow('Value must exist.')
    })

    it('값이 존재하면 그대로 반환한다', () => {
        expect(ensure('hello')).toBe('hello')
    })

    it('0/false/""은 통과시키고 null/undefined만 예외를 던진다', () => {
        expect(ensure(0)).toBe(0)
        expect(ensure(false)).toBe(false)
        expect(ensure('')).toBe('')

        expect(() => ensure(null)).toThrow('Value must exist.')
        expect(() => ensure(undefined)).toThrow('Value must exist.')
    })
})
