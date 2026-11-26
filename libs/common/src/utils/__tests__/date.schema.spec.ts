import { InstantFromInputSchema, PlainDateFromInputSchema } from '#common/utils'

describe('InstantFromInputSchema, PlainDateFromInputSchema', () => {
    describe.each(['buddhist', 'japanese', 'hebrew'])(
        'PlainDate가 %s 달력으로 표현되어 있으면',
        (calendar) => {
            let input: Temporal.PlainDate
            beforeEach(() => {
                input = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)
            })
            it('스키마로 변환하면 같은 ISO 날짜를 반환하고 원본을 보존한다', () => {
                const output = PlainDateFromInputSchema.parse(input)

                expect(output.calendarId).toBe('iso8601')
                expect(output.toString()).toBe('2025-01-01')
                expect(input.calendarId).toBe(calendar)
            })
        }
    )

    it('UTC 시각 문자열을 Instant로 변환한다', () => {
        const instant = InstantFromInputSchema.parse('2023-06-18T12:12:34.567Z')
        expect(instant).toBeInstanceOf(Temporal.Instant)
        expect(instant.toString()).toBe('2023-06-18T12:12:34.567Z')
    })
    it('날짜 문자열을 PlainDate로 변환한다', () => {
        const date = PlainDateFromInputSchema.parse('2023-06-18')
        expect(date).toBeInstanceOf(Temporal.PlainDate)
        expect(date.toString()).toBe('2023-06-18')
    })

    describe.each([
        { condition: 'Instant 입력이 시각이 아닌 문자열이면', input: 'not-an-instant' },
        {
            condition: 'Instant 입력이 UTC가 아닌 시각 문자열이면',
            input: '2023-06-18T12:12:34+09:00'
        },
        { condition: 'Instant 입력이 숫자이면', input: 0 }
    ])('$condition', ({ input }) => {
        let value: typeof input
        beforeEach(() => {
            value = input
        })
        it('검증에 실패한다', () => {
            expect(InstantFromInputSchema.safeParse(value).success).toBe(false)
        })
    })
    describe.each([
        { condition: 'PlainDate 입력이 날짜가 아닌 문자열이면', input: 'not-a-date' },
        { condition: 'PlainDate 입력이 시각이 포함된 문자열이면', input: '2023-06-18T00:00:00Z' },
        { condition: 'PlainDate 입력이 불리언이면', input: false }
    ])('$condition', ({ input }) => {
        let value: typeof input
        beforeEach(() => {
            value = input
        })
        it('검증에 실패한다', () => {
            expect(PlainDateFromInputSchema.safeParse(value).success).toBe(false)
        })
    })
})
