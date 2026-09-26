import { TimeUtil } from '../index.js'

describe('TimeUtil', () => {
    describe('toMs', () => {
        it('ms 단위는 그대로 변환한다', () => {
            expect(TimeUtil.toMs('500ms')).toEqual(500)
        })

        it('s, m, h, d 단위를 ms로 변환한다', () => {
            expect(TimeUtil.toMs('45s')).toEqual(45 * 1000)
            expect(TimeUtil.toMs('30m')).toEqual(30 * 60 * 1000)
            expect(TimeUtil.toMs('2h')).toEqual(2 * 60 * 60 * 1000)
            expect(TimeUtil.toMs('1d')).toEqual(24 * 60 * 60 * 1000)
        })

        it('여러 단위는 공백 유무 관계없이 합산한다', () => {
            expect(TimeUtil.toMs('1d 2h')).toEqual((24 + 2) * 60 * 60 * 1000)
            expect(TimeUtil.toMs('1d2h')).toEqual((24 + 2) * 60 * 60 * 1000)
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

        it('지수 표기의 부호와 단위를 함께 읽는다', () => {
            expect(TimeUtil.toMs('1s1e-7ms')).toBe(1000.0000001)
            expect(TimeUtil.toMs('-1s-1e-7ms')).toBe(-1000.0000001)
            expect(TimeUtil.toMs('1E+2ms')).toBe(100)
        })

        it.each(['1ems', '1e-ms', '1e+ms', '1e1e2ms'])(
            '불완전한 지수 표현 %s는 예외를 던진다',
            (value) => expect(() => TimeUtil.toMs(value)).toThrow(InternalServerErrorException)
        )
    })

    describe('fromMs', () => {
        it('가장 큰 적합한 단위 하나로 표시한다', () => {
            expect(TimeUtil.fromMs(30 * 60 * 1000)).toEqual('30m')
            expect(TimeUtil.fromMs(45 * 1000)).toEqual('45s')
            expect(TimeUtil.fromMs(24 * 60 * 60 * 1000)).toEqual('1d')
            expect(TimeUtil.fromMs(2 * 60 * 60 * 1000)).toEqual('2h')
            expect(TimeUtil.fromMs(500)).toEqual('500ms')
        })

        it('여러 단위가 섞이면 단위를 붙여 표시한다', () => {
            expect(TimeUtil.fromMs((24 + 2) * 60 * 60 * 1000)).toEqual('1d2h')
        })

        it('0은 "0ms"를 반환한다', () => {
            expect(TimeUtil.fromMs(0)).toEqual('0ms')
        })

        it('음수 값도 변환한다', () => {
            expect(TimeUtil.fromMs(-30 * 1000)).toEqual('-30s')
        })

        it('음수 복합 시간도 표시한 뒤 파싱하면 원래 밀리초가 된다', () => {
            expect(TimeUtil.fromMs(-5_400_000)).toBe('-1h-30m')
            for (const value of [-5_400_000, -93_784_005, -0.5, 93_784_005]) {
                expect(TimeUtil.toMs(TimeUtil.fromMs(value))).toBe(value)
            }
        })

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
