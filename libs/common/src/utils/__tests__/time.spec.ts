import { TimeUtil } from '../index.js'

describe('TimeUtil', () => {
    describe('toMs', () => {
        it('ms 단위는 그대로 변환한다', () => {
            expect(TimeUtil.toMs('500ms')).toEqual(500)
        })

        it.each([
            ['45s', 45 * 1000],
            ['30m', 30 * 60 * 1000],
            ['2h', 2 * 60 * 60 * 1000],
            ['1d', 24 * 60 * 60 * 1000]
        ] as const)('%s를 밀리초로 변환한다', (input, expected) => {
            expect(TimeUtil.toMs(input)).toEqual(expected)
        })

        it.each(['1d 2h', '1d2h'])('%s의 각 단위를 합산해 밀리초로 변환한다', (input) => {
            expect(TimeUtil.toMs(input)).toEqual((24 + 2) * 60 * 60 * 1000)
        })

        it('소수점 값도 변환한다', () => {
            expect(TimeUtil.toMs('0.5s')).toEqual(0.5 * 1000)
        })

        it('음수 값도 변환한다', () => {
            expect(TimeUtil.toMs('-30s')).toEqual(-30 * 1000)
        })

        it('유효하지 않은 형식이면 예외를 던진다', () => {
            expect(() => TimeUtil.toMs('2z')).toThrow(InternalServerErrorException)
        })

        it.each([
            ['1s1e-7ms', 1000.0000001],
            ['-1s-1e-7ms', -1000.0000001],
            ['1E+2ms', 100]
        ] as const)('지수 표기가 포함된 %s를 밀리초로 변환한다', (input, expected) => {
            expect(TimeUtil.toMs(input)).toBe(expected)
        })

        it.each(['1ems', '1e-ms', '1e+ms', '1e1e2ms'])(
            '불완전한 지수 표현 %s는 예외를 던진다',
            (value) => expect(() => TimeUtil.toMs(value)).toThrow(InternalServerErrorException)
        )
    })

    describe('fromMs', () => {
        it.each([
            [30 * 60 * 1000, '30m'],
            [45 * 1000, '45s'],
            [24 * 60 * 60 * 1000, '1d'],
            [2 * 60 * 60 * 1000, '2h'],
            [500, '500ms']
        ] as const)(
            '%s 밀리초를 나머지 없이 표현할 수 있는 가장 큰 단위로 표시한다',
            (input, expected) => {
                expect(TimeUtil.fromMs(input)).toEqual(expected)
            }
        )

        it('여러 단위가 섞이면 단위를 붙여 표시한다', () => {
            expect(TimeUtil.fromMs((24 + 2) * 60 * 60 * 1000)).toEqual('1d2h')
        })

        it('0은 "0ms"를 반환한다', () => {
            expect(TimeUtil.fromMs(0)).toEqual('0ms')
        })

        it('음수 값도 변환한다', () => {
            expect(TimeUtil.fromMs(-30 * 1000)).toEqual('-30s')
        })

        it('음수 복합 시간은 각 단위에 부호를 표시한다', () => {
            expect(TimeUtil.fromMs(-5_400_000)).toBe('-1h-30m')
        })
        it.each([-5_400_000, -93_784_005, -0.5, 93_784_005])(
            '%s 밀리초를 표시한 뒤 읽으면 원래 값으로 돌아온다',
            (value) => {
                expect(TimeUtil.toMs(TimeUtil.fromMs(value))).toBe(value)
            }
        )

        it.each([
            1e-7,
            -1e-7,
            Number.MIN_VALUE,
            -Number.MIN_VALUE,
            1000.0000001,
            1e21,
            -1e21,
            9223950542569945000
        ])('%s 밀리초를 표시한 문자열을 같은 값으로 되돌린다', (value) =>
            expect(TimeUtil.toMs(TimeUtil.fromMs(value))).toBe(value)
        )
    })
})
import { InternalServerErrorException } from '@nestjs/common'
