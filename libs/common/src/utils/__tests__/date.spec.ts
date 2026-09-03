import { DateUtil } from '../index.js'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        it('YYYYMMDDHHmm 형식 문자열을 PlainDateTime으로 변환한다', () => {
            const dateTime = DateUtil.fromYMDHM('199901020930')

            expect(dateTime).toBeInstanceOf(Temporal.PlainDateTime)
            expect(dateTime.toString()).toBe('1999-01-02T09:30:00')
        })

        it('YYYYMMDD 형식 문자열을 PlainDate로 변환한다', () => {
            const date = DateUtil.fromYMD('19990102')

            expect(date).toBeInstanceOf(Temporal.PlainDate)
            expect(date.toString()).toBe('1999-01-02')
        })

        it('형식이나 달력 값이 잘못되면 예외를 던진다', () => {
            expect(() => DateUtil.fromYMD('')).toThrow()
            expect(() => DateUtil.fromYMD('20201301')).toThrow()
            expect(() => DateUtil.fromYMD('20230230')).toThrow()
            expect(() => DateUtil.fromYMDHM('19990102')).toThrow()
        })
    })

    describe('toYMD', () => {
        it('PlainDate를 YYYYMMDD 형식 문자열로 변환한다', () => {
            expect(DateUtil.toYMD(Temporal.PlainDate.from('1999-01-02'))).toBe('19990102')
        })

        it('YYYYMMDD로 표현할 수 없는 확장 연도는 거부한다', () => {
            expect(() => DateUtil.toYMD(Temporal.PlainDate.from('-000001-01-02'))).toThrow(
                RangeError
            )
            expect(() => DateUtil.toYMD(Temporal.PlainDate.from('+010000-01-02'))).toThrow(
                RangeError
            )
        })
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

        it('빈 배열이면 잘못된 시각 대신 명시적으로 예외를 던진다', () => {
            expect(() => DateUtil.earliest([])).toThrow(RangeError)
            expect(() => DateUtil.latest([])).toThrow(RangeError)
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

    describe('외부 Date 경계', () => {
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

        it('0~99년도 1900년대로 보정하지 않고 그대로 보존한다', () => {
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
        it('지원 입력을 밀리초 Instant로 정규화한다', () => {
            const instant = Temporal.Instant.from('2023-06-18T12:12:34.123456789Z')

            expect(DateUtil.instantFromInput(instant).toString()).toBe('2023-06-18T12:12:34.123Z')
            expect(DateUtil.instantFromInput(new Date(1)).epochMilliseconds).toBe(1)
            expect(DateUtil.instantFromInput('1970-01-01T00:00:00.002Z').epochMilliseconds).toBe(2)
            expect(() => DateUtil.instantFromInput('1970-01-01T00:00:00+09:00')).toThrow()
            expect(() => DateUtil.instantFromInput('1970-01-01T00:00Z')).toThrow()
        })

        it('지원 입력을 PlainDate로 정규화한다', () => {
            const date = Temporal.PlainDate.from('2023-06-18')

            expect(DateUtil.plainDateFromInput(date)).toBe(date)
            expect(DateUtil.plainDateFromInput(new Date('2023-06-18T23:00:00Z')).toString()).toBe(
                '2023-06-18'
            )
            expect(DateUtil.plainDateFromInput('2023-06-18').toString()).toBe('2023-06-18')
            expect(DateUtil.plainDateFromInput('+010000-01-02').toString()).toBe('+010000-01-02')
            expect(() => DateUtil.plainDateFromInput('2023-06-18T23:00:00Z')).toThrow()
            expect(() => DateUtil.plainDateFromInput('2023-06-18T23:00:00')).toThrow()
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
})
