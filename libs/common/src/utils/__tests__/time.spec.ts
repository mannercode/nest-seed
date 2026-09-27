import { TimeUtil } from '../index.js'

describe('TimeUtil', () => {
    describe('toMs', () => {
        describe('시간 문자열의 단위가 ms이면', () => {
            let input: string
            beforeEach(() => {
                input = '500ms'
            })
            it('밀리초로 변환하면 원래 값을 반환한다', () => {
                expect(TimeUtil.toMs(input)).toEqual(500)
            })
        })

        describe.each([
            ['45s', 45 * 1000],
            ['30m', 30 * 60 * 1000],
            ['2h', 2 * 60 * 60 * 1000],
            ['1d', 24 * 60 * 60 * 1000]
        ] as const)('시간 문자열이 %s이면', (input, expected) => {
            let value: string
            beforeEach(() => {
                value = input
            })
            it('밀리초로 변환하면 단위에 해당하는 값을 반환한다', () => {
                expect(TimeUtil.toMs(value)).toEqual(expected)
            })
        })

        describe.each(['1d 2h', '1d2h'])('시간 문자열이 여러 단위를 포함한 "%s"이면', (input) => {
            let value: string
            beforeEach(() => {
                value = input
            })
            it('밀리초로 변환하면 각 단위를 합산한다', () => {
                expect(TimeUtil.toMs(value)).toEqual((24 + 2) * 60 * 60 * 1000)
            })
        })

        describe('시간 문자열의 값이 소수이면', () => {
            let input: string
            beforeEach(() => {
                input = '0.5s'
            })
            it('밀리초로 변환하면 소수 값을 반영한다', () => {
                expect(TimeUtil.toMs(input)).toEqual(0.5 * 1000)
            })
        })

        describe('시간 문자열의 값이 음수이면', () => {
            let input: string
            beforeEach(() => {
                input = '-30s'
            })
            it('밀리초로 변환하면 음수를 반환한다', () => {
                expect(TimeUtil.toMs(input)).toEqual(-30 * 1000)
            })
        })

        describe('시간 문자열의 단위가 유효하지 않으면', () => {
            let input: string
            beforeEach(() => {
                input = '2z'
            })
            it('밀리초로 변환하면 예외를 던진다', () => {
                expect(() => TimeUtil.toMs(input)).toThrow(InternalServerErrorException)
            })
        })

        describe.each([
            ['1s1e-7ms', 1000.0000001],
            ['-1s-1e-7ms', -1000.0000001],
            ['1E+2ms', 100]
        ] as const)('시간 문자열이 지수 표기를 포함한 "%s"이면', (input, expected) => {
            let value: string
            beforeEach(() => {
                value = input
            })
            it('밀리초로 변환하면 지수 값을 반영한다', () => {
                expect(TimeUtil.toMs(value)).toBe(expected)
            })
        })

        describe.each(['1ems', '1e-ms', '1e+ms', '1e1e2ms'])(
            '시간 문자열의 지수 표현이 불완전한 %s이면',
            (value) => {
                let input: string
                beforeEach(() => {
                    input = value
                })
                it('밀리초로 변환하면 예외를 던진다', () => {
                    expect(() => TimeUtil.toMs(input)).toThrow(InternalServerErrorException)
                })
            }
        )
    })

    describe('fromMs', () => {
        describe.each([
            [30 * 60 * 1000, '30m'],
            [45 * 1000, '45s'],
            [24 * 60 * 60 * 1000, '1d'],
            [2 * 60 * 60 * 1000, '2h'],
            [500, '500ms']
        ] as const)('밀리초 값이 %s이면', (input, expected) => {
            let value: number
            beforeEach(() => {
                value = input
            })
            it('문자열로 변환하면 나머지 없이 표현할 수 있는 가장 큰 단위를 쓴다', () => {
                expect(TimeUtil.fromMs(value)).toEqual(expected)
            })
        })

        describe('밀리초 값이 1일 2시간에 해당하면', () => {
            let input: number
            beforeEach(() => {
                input = (24 + 2) * 60 * 60 * 1000
            })
            it('문자열로 변환하면 "1d2h"를 반환한다', () => {
                expect(TimeUtil.fromMs(input)).toEqual('1d2h')
            })
        })

        describe('밀리초 값이 0이면', () => {
            let input: number
            beforeEach(() => {
                input = 0
            })
            it('문자열로 변환하면 "0ms"를 반환한다', () => {
                expect(TimeUtil.fromMs(input)).toEqual('0ms')
            })
        })

        describe('밀리초 값이 -30초에 해당하면', () => {
            let input: number
            beforeEach(() => {
                input = -30 * 1000
            })
            it('문자열로 변환하면 "-30s"를 반환한다', () => {
                expect(TimeUtil.fromMs(input)).toEqual('-30s')
            })
        })

        describe('밀리초 값이 -1시간 30분에 해당하면', () => {
            let input: number
            beforeEach(() => {
                input = -5_400_000
            })
            it('문자열로 변환하면 각 단위에 음수 부호를 표시한다', () => {
                expect(TimeUtil.fromMs(input)).toBe('-1h-30m')
            })

            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(TimeUtil.toMs(TimeUtil.fromMs(input))).toBe(-5_400_000)
            })
        })
        describe.each([
            -93_784_005,
            -0.5,
            93_784_005,
            1e-7,
            -1e-7,
            Number.MIN_VALUE,
            -Number.MIN_VALUE,
            1000.0000001,
            1e21,
            -1e21,
            9223950542569945000
        ])('밀리초 값이 %s이면', (value) => {
            let input: number
            beforeEach(() => {
                input = value
            })
            it('문자열로 변환한 뒤 읽으면 원래 값으로 돌아온다', () => {
                expect(TimeUtil.toMs(TimeUtil.fromMs(input))).toBe(value)
            })
        })
    })
})
import { InternalServerErrorException } from '@nestjs/common'
