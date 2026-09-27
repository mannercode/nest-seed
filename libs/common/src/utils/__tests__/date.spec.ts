import { InternalServerErrorException } from '@nestjs/common'
import { DateUtil } from '../index.js'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        it('YYYYMMDD 형식 문자열을 PlainDate로 변환한다', () => {
            const date = DateUtil.fromYMD('19990102')

            expect(date).toBeInstanceOf(Temporal.PlainDate)
            expect(date.toString()).toBe('1999-01-02')
        })

        describe.each([
            { condition: 'YYYYMMDD 입력이 빈 문자열이면', input: '' },
            { condition: '입력 날짜의 월이 13이면', input: '20201301' },
            { condition: '입력 날짜가 2월 30일이면', input: '20230230' }
        ])('$condition', ({ input }) => {
            let value: string
            beforeEach(() => {
                value = input
            })
            it('날짜로 변환하면 예외를 던진다', () => {
                expect(() => DateUtil.fromYMD(value)).toThrow()
            })
        })
    })

    describe('toYMD', () => {
        describe.each(['buddhist', 'japanese', 'hebrew'])(
            '날짜가 %s 달력으로 표현되어 있으면',
            (calendar) => {
                let date: Temporal.PlainDate
                beforeEach(() => {
                    date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
                })
                it('날짜와 날짜시각을 YYYYMMDD로 변환하면 같은 ISO 날짜를 반환한다', () => {
                    expect(DateUtil.toYMD(date)).toBe('20250101')
                    expect(DateUtil.toYMD(date.toPlainDateTime())).toBe('20250101')
                })
            }
        )

        it('PlainDate를 YYYYMMDD 형식 문자열로 변환한다', () => {
            expect(DateUtil.toYMD(Temporal.PlainDate.from('1999-01-02'))).toBe('19990102')
        })

        describe.each(['-000001-01-02', '+010000-01-02'])(
            '날짜가 네 자리 연도 범위 밖인 %s이면',
            (value) => {
                let date: Temporal.PlainDate
                beforeEach(() => {
                    date = Temporal.PlainDate.from(value)
                })
                it('YYYYMMDD로 변환하면 예외를 던진다', () => {
                    expect(() => DateUtil.toYMD(date)).toThrow(InternalServerErrorException)
                })
            }
        )
    })

    describe('earliest, latest', () => {
        const earliest = Temporal.Instant.from('2022-01-01T12:00:00Z')
        const latest = Temporal.Instant.from('2022-01-03T15:30:00Z')
        const middle = Temporal.Instant.from('2022-01-02T09:20:00Z')
        const instants = [middle, earliest, latest]

        it('가장 이른 시각과 늦은 시각을 반환한다', () => {
            expect(DateUtil.earliest(instants).equals(earliest)).toBe(true)
            expect(DateUtil.latest(instants).equals(latest)).toBe(true)
        })

        describe('시각 목록이 비어 있으면', () => {
            let instants: Temporal.Instant[]
            beforeEach(() => {
                instants = []
            })
            it('가장 이른 시각이나 늦은 시각을 찾으면 예외를 던진다', () => {
                expect(() => DateUtil.earliest(instants)).toThrow(InternalServerErrorException)
                expect(() => DateUtil.latest(instants)).toThrow(InternalServerErrorException)
            })
        })
    })

    it('epoch 기준 Instant를 반환한다', () => {
        expect(DateUtil.epoch().epochMilliseconds).toBe(0)
    })

    describe('now', () => {
        it('밀리초 정밀도의 현재 시각을 반환한다', () => {
            const before = Temporal.Now.instant().epochMilliseconds
            const now = DateUtil.now()
            const after = Temporal.Now.instant().epochMilliseconds

            expect(now.epochMilliseconds).toBeGreaterThanOrEqual(before)
            expect(now.epochMilliseconds).toBeLessThanOrEqual(after)
            expect(now.epochNanoseconds % 1_000_000n).toBe(0n)
        })
    })

    describe('add', () => {
        it('주어진 오프셋을 절대 시간 기준으로 합산한다', () => {
            const base = Temporal.Instant.from('2020-06-15T12:00:00Z')
            const result = DateUtil.add({ base, days: 1, hours: -3, minutes: 30 })

            expect(result.toString()).toBe('2020-06-16T09:30:00Z')
        })

        describe('기준 시각과 오프셋을 지정하지 않았으면', () => {
            let options: Parameters<typeof DateUtil.add>[0]
            beforeEach(() => {
                options = {}
            })
            it('시각을 계산하면 현재 시각을 반환한다', () => {
                const before = Temporal.Now.instant().epochMilliseconds
                const instant = DateUtil.add(options)
                const after = Temporal.Now.instant().epochMilliseconds

                expect(instant.epochMilliseconds).toBeGreaterThanOrEqual(before)
                expect(instant.epochMilliseconds).toBeLessThanOrEqual(after)
            })
        })

        describe('기준 시각과 더할 값에 밀리초가 포함되어 있으면', () => {
            let options: Parameters<typeof DateUtil.add>[0]
            beforeEach(() => {
                options = {
                    base: Temporal.Instant.from('2020-01-01T00:00:00.123Z'),
                    milliseconds: 1
                }
            })
            it('시각을 더하면 밀리초 단위를 보존한다', () => {
                const instant = DateUtil.add(options)

                expect(DateUtil.toISOString(instant)).toBe('2020-01-01T00:00:00.124Z')
            })
        })
    })

    describe('외부 API에 사용할 Date 객체 변환', () => {
        describe.each(['buddhist', 'japanese', 'hebrew'])(
            '날짜가 %s 달력으로 표현되어 있으면',
            (calendar) => {
                let date: Temporal.PlainDate
                beforeEach(() => {
                    date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
                })
                it('Date로 변환하면 같은 날짜의 UTC 자정으로 저장하고 ISO 날짜로 복원한다', () => {
                    const stored = DateUtil.plainDateToDate(date)
                    const restored = DateUtil.toPlainDate(stored)

                    expect(stored.toISOString()).toBe('2025-01-01T00:00:00.000Z')
                    expect(restored.calendarId).toBe('iso8601')
                    expect(restored.toString()).toBe('2025-01-01')
                })
            }
        )

        describe('입력이 밀리초를 포함한 Instant이면', () => {
            let instant: Temporal.Instant
            beforeEach(() => {
                instant = Temporal.Instant.from('2023-06-18T12:12:34.567Z')
            })
            it('Date로 변환하고 복원해도 원래 시각을 유지한다', () => {
                expect(DateUtil.fromDate(DateUtil.toDate(instant)).equals(instant)).toBe(true)
            })
        })

        describe('입력이 ISO 달력의 PlainDate이면', () => {
            let plainDate: Temporal.PlainDate
            beforeEach(() => {
                plainDate = Temporal.PlainDate.from('2023-06-18')
            })
            it('UTC 자정 Date로 변환하고 복원해도 날짜를 유지한다', () => {
                expect(
                    DateUtil.toPlainDate(DateUtil.plainDateToDate(plainDate)).equals(plainDate)
                ).toBe(true)
            })
        })

        describe('날짜의 연도가 0이면', () => {
            let plainDate: Temporal.PlainDate
            beforeEach(() => {
                plainDate = Temporal.PlainDate.from('0000-01-01')
            })
            it('Date로 변환하고 복원해도 연도를 유지한다', () => {
                expect(DateUtil.plainDateToDate(plainDate).toISOString()).toBe(
                    '0000-01-01T00:00:00.000Z'
                )
                expect(
                    DateUtil.toPlainDate(DateUtil.plainDateToDate(plainDate)).equals(plainDate)
                ).toBe(true)
            })
        })
    })

    describe('입력 정규화', () => {
        describe('instantFromInput', () => {
            describe.each([
                {
                    condition: '입력이 나노초 정밀도의 Instant이면',
                    input: Temporal.Instant.from('2023-06-18T12:12:34.123456789Z'),
                    expected: '2023-06-18T12:12:34.123Z'
                },
                {
                    condition: '입력이 Date 객체이면',
                    input: new Date(1),
                    expected: '1970-01-01T00:00:00.001Z'
                },
                {
                    condition: '입력이 UTC 시각 문자열이면',
                    input: '1970-01-01T00:00:00.002Z',
                    expected: '1970-01-01T00:00:00.002Z'
                }
            ])('$condition', ({ input, expected }) => {
                let value: typeof input
                beforeEach(() => {
                    value = input
                })
                it('Instant로 변환하면 밀리초 정밀도로 반환한다', () => {
                    expect(DateUtil.instantFromInput(value).toString()).toBe(expected)
                })
            })
            describe.each([
                { label: 'UTC가 아닌', input: '1970-01-01T00:00:00+09:00' },
                { label: '초가 없는', input: '1970-01-01T00:00Z' }
            ])('$label 시각 문자열이면', ({ input }) => {
                let value: string
                beforeEach(() => {
                    value = input
                })
                it('Instant로 변환하면 예외를 던진다', () => {
                    expect(() => DateUtil.instantFromInput(value)).toThrow()
                })
            })
        })
        describe('plainDateFromInput', () => {
            describe('입력이 ISO 달력의 PlainDate 객체이면', () => {
                let date: Temporal.PlainDate
                beforeEach(() => {
                    date = Temporal.PlainDate.from('2023-06-18')
                })
                it('날짜를 정규화하면 같은 객체를 반환한다', () => {
                    expect(DateUtil.plainDateFromInput(date)).toBe(date)
                })
            })
            describe.each([
                {
                    condition: '입력이 Date 객체이면',
                    input: new Date('2023-06-18T23:00:00Z'),
                    expected: '2023-06-18'
                },
                {
                    condition: '입력이 날짜 문자열이면',
                    input: '2023-06-18',
                    expected: '2023-06-18'
                },
                {
                    condition: '입력이 확장 연도 문자열이면',
                    input: '+010000-01-02',
                    expected: '+010000-01-02'
                }
            ])('$condition', ({ input, expected }) => {
                let value: typeof input
                beforeEach(() => {
                    value = input
                })
                it('PlainDate로 변환하면 해당 날짜를 반환한다', () => {
                    expect(DateUtil.plainDateFromInput(value).toString()).toBe(expected)
                })
            })
            describe.each(['2023-06-18T23:00:00Z', '2023-06-18T23:00:00'])(
                '입력이 시각을 포함한 %s 문자열이면',
                (input) => {
                    let value: string
                    beforeEach(() => {
                        value = input
                    })
                    it('PlainDate로 변환하면 예외를 던진다', () => {
                        expect(() => DateUtil.plainDateFromInput(value)).toThrow()
                    })
                }
            )
        })
    })

    it('UTC 날짜 범위의 양끝을 밀리초 정밀도로 만든다', () => {
        const date = Temporal.PlainDate.from('2023-06-18')

        expect(DateUtil.startOfUtcDay(date).toString()).toBe('2023-06-18T00:00:00Z')
        expect(DateUtil.endOfUtcDay(date).toString()).toBe('2023-06-18T23:59:59.999Z')
        expect(DateUtil.toEpochMilliseconds(DateUtil.startOfUtcDay(date))).toBe(
            Date.UTC(2023, 5, 18)
        )
    })

    describe.each(['buddhist', 'japanese', 'hebrew'])(
        '날짜가 %s 달력으로 표현되어 있으면',
        (calendar) => {
            let date: Temporal.PlainDate
            beforeEach(() => {
                date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
            })
            it('하루의 시작과 끝을 계산하면 같은 ISO 날짜의 UTC 범위를 반환한다', () => {
                expect(DateUtil.startOfUtcDay(date).toString()).toBe('2025-01-01T00:00:00Z')
                expect(DateUtil.endOfUtcDay(date).toString()).toBe('2025-01-01T23:59:59.999Z')
            })
        }
    )

    describe('fromYMDHM', () => {
        it('YYYYMMDDHHmm 형식 문자열을 PlainDateTime으로 변환한다', () => {
            const dateTime = DateUtil.fromYMDHM('199901020930')

            expect(dateTime).toBeInstanceOf(Temporal.PlainDateTime)
            expect(dateTime.toString()).toBe('1999-01-02T09:30:00')
        })
        describe('입력 문자열에 날짜만 있고 시각이 없으면', () => {
            let input: Parameters<typeof DateUtil.fromYMDHM>[0]
            beforeEach(() => {
                input = '19990102'
            })
            it('날짜시각으로 변환하면 예외를 던진다', () => {
                expect(() => DateUtil.fromYMDHM(input)).toThrow()
            })
        })
    })
})
