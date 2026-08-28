import { TimeUtil } from '../time'

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
            expect(() => TimeUtil.toMs('2z')).toThrow(Error)
        })
    })
})
