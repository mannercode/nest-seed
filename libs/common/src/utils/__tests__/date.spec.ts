import { InternalServerErrorException } from '@nestjs/common'
import { DateUtil } from '../index.js'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        it('YYYYMMDD 형식 문자열을 PlainDate로 변환한다', () => {
            const date = DateUtil.fromYMD('19990102')

            expect(date).toBeInstanceOf(Temporal.PlainDate)
            expect(date.toString()).toBe('1999-01-02')
        })

        it.each([
            { label: '빈 문자열', input: '' },
            { label: '13월', input: '20201301' },
            { label: '2월 30일', input: '20230230' }
        ])('$label 입력으로 변환하면 예외를 던진다', ({ input }) => {
            expect(() => DateUtil.fromYMD(input)).toThrow()
        })
    })

    describe('toYMD', () => {
        it.each(['buddhist', 'japanese', 'hebrew'])(
            '%s 달력의 날짜와 날짜시각을 같은 ISO 날짜의 YYYYMMDD로 표현한다',
            (calendar) => {
                const date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)

                expect(DateUtil.toYMD(date)).toBe('20250101')
                expect(DateUtil.toYMD(date.toPlainDateTime())).toBe('20250101')
            }
        )

        it('PlainDate를 YYYYMMDD 형식 문자열로 변환한다', () => {
            expect(DateUtil.toYMD(Temporal.PlainDate.from('1999-01-02'))).toBe('19990102')
        })

        it.each(['-000001-01-02', '+010000-01-02'])(
            '%s를 YYYYMMDD로 변환하면 예외를 던진다',
            (value) => {
                expect(() => DateUtil.toYMD(Temporal.PlainDate.from(value))).toThrow(
                    InternalServerErrorException
                )
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

        it('빈 배열에서 가장 이른 시각이나 늦은 시각을 찾으면 예외를 던진다', () => {
            expect(() => DateUtil.earliest([])).toThrow(InternalServerErrorException)
            expect(() => DateUtil.latest([])).toThrow(InternalServerErrorException)
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

        it('base가 없으면 현재 시각을 기준으로 한다', () => {
            const before = Temporal.Now.instant().epochMilliseconds
            const instant = DateUtil.add({})
            const after = Temporal.Now.instant().epochMilliseconds

            expect(instant.epochMilliseconds).toBeGreaterThanOrEqual(before)
            expect(instant.epochMilliseconds).toBeLessThanOrEqual(after)
        })

        it('밀리초 단위를 보존한다', () => {
            const instant = DateUtil.add({
                base: Temporal.Instant.from('2020-01-01T00:00:00.123Z'),
                milliseconds: 1
            })

            expect(DateUtil.toISOString(instant)).toBe('2020-01-01T00:00:00.124Z')
        })
    })

    describe('외부 API에 사용할 Date 객체 변환', () => {
        it.each(['buddhist', 'japanese', 'hebrew'])(
            '%s 달력의 날짜를 같은 날짜의 UTC 자정에 저장하고 ISO로 복원한다',
            (calendar) => {
                const date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)

                const stored = DateUtil.plainDateToDate(date)
                const restored = DateUtil.toPlainDate(stored)

                expect(stored.toISOString()).toBe('2025-01-01T00:00:00.000Z')
                expect(restored.calendarId).toBe('iso8601')
                expect(restored.toString()).toBe('2025-01-01')
            }
        )

        it('Instant와 BSON Date 호환 값을 밀리초 손실 없이 왕복한다', () => {
            const instant = Temporal.Instant.from('2023-06-18T12:12:34.567Z')

            expect(DateUtil.fromDate(DateUtil.toDate(instant)).equals(instant)).toBe(true)
        })

        it('PlainDate를 UTC 자정 Date로 저장하고 복원한다', () => {
            const plainDate = Temporal.PlainDate.from('2023-06-18')

            expect(
                DateUtil.toPlainDate(DateUtil.plainDateToDate(plainDate)).equals(plainDate)
            ).toBe(true)
        })

        it('0년의 날짜를 Date로 변환하고 복원해도 연도를 유지한다', () => {
            const plainDate = Temporal.PlainDate.from('0000-01-01')

            expect(DateUtil.plainDateToDate(plainDate).toISOString()).toBe(
                '0000-01-01T00:00:00.000Z'
            )
            expect(
                DateUtil.toPlainDate(DateUtil.plainDateToDate(plainDate)).equals(plainDate)
            ).toBe(true)
        })
    })

    describe('입력 정규화', () => {
        it.each([
            {
                label: '나노초 정밀도의 Instant',
                input: Temporal.Instant.from('2023-06-18T12:12:34.123456789Z'),
                expected: '2023-06-18T12:12:34.123Z'
            },
            { label: 'Date 객체', input: new Date(1), expected: '1970-01-01T00:00:00.001Z' },
            {
                label: 'UTC 시각 문자열',
                input: '1970-01-01T00:00:00.002Z',
                expected: '1970-01-01T00:00:00.002Z'
            }
        ])('$label 입력을 밀리초 Instant로 변환한다', ({ input, expected }) => {
            expect(DateUtil.instantFromInput(input).toString()).toBe(expected)
        })
        it.each([
            { label: 'UTC가 아닌', input: '1970-01-01T00:00:00+09:00' },
            { label: '초가 없는', input: '1970-01-01T00:00Z' }
        ])('$label 시각 문자열을 Instant로 변환하면 예외를 던진다', ({ input }) => {
            expect(() => DateUtil.instantFromInput(input)).toThrow()
        })

        it('PlainDate 입력은 같은 객체를 반환한다', () => {
            const date = Temporal.PlainDate.from('2023-06-18')
            expect(DateUtil.plainDateFromInput(date)).toBe(date)
        })
        it.each([
            { label: 'Date 객체', input: new Date('2023-06-18T23:00:00Z'), expected: '2023-06-18' },
            { label: '날짜 문자열', input: '2023-06-18', expected: '2023-06-18' },
            { label: '확장 연도 문자열', input: '+010000-01-02', expected: '+010000-01-02' }
        ])('$label 입력을 PlainDate로 변환한다', ({ input, expected }) => {
            expect(DateUtil.plainDateFromInput(input).toString()).toBe(expected)
        })
        it.each(['2023-06-18T23:00:00Z', '2023-06-18T23:00:00'])(
            '시각이 포함된 %s를 PlainDate로 변환하면 예외를 던진다',
            (input) => {
                expect(() => DateUtil.plainDateFromInput(input)).toThrow()
            }
        )
    })

    it('UTC 날짜 범위의 양끝을 밀리초 정밀도로 만든다', () => {
        const date = Temporal.PlainDate.from('2023-06-18')

        expect(DateUtil.startOfUtcDay(date).toString()).toBe('2023-06-18T00:00:00Z')
        expect(DateUtil.endOfUtcDay(date).toString()).toBe('2023-06-18T23:59:59.999Z')
        expect(DateUtil.toEpochMilliseconds(DateUtil.startOfUtcDay(date))).toBe(
            Date.UTC(2023, 5, 18)
        )
    })

    it.each(['buddhist', 'japanese', 'hebrew'])(
        '%s 달력의 날짜도 같은 ISO 날짜의 UTC 범위를 반환한다',
        (calendar) => {
            const date = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)

            expect(DateUtil.startOfUtcDay(date).toString()).toBe('2025-01-01T00:00:00Z')
            expect(DateUtil.endOfUtcDay(date).toString()).toBe('2025-01-01T23:59:59.999Z')
        }
    )

    describe('fromYMDHM', () => {
        it('YYYYMMDDHHmm 형식 문자열을 PlainDateTime으로 변환한다', () => {
            const dateTime = DateUtil.fromYMDHM('199901020930')

            expect(dateTime).toBeInstanceOf(Temporal.PlainDateTime)
            expect(dateTime.toString()).toBe('1999-01-02T09:30:00')
        })
        it('날짜만 입력하면 예외를 던진다', () => {
            expect(() => DateUtil.fromYMDHM('19990102')).toThrow()
        })
    })
})
