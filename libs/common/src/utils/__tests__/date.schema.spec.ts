import { InstantFromInputSchema, PlainDateFromInputSchema } from '../index.js'

describe('InstantFromInputSchema, PlainDateFromInputSchema', () => {
    it.each(['buddhist', 'japanese', 'hebrew'])(
        '%s 달력 객체를 같은 날짜의 ISO PlainDate로 정규화하고 원본을 보존한다',
        (calendar) => {
            const input = Temporal.PlainDate.from('2025-01-01').withCalendar(calendar)

            const output = PlainDateFromInputSchema.parse(input)

            expect(output.calendarId).toBe('iso8601')
            expect(output.toString()).toBe('2025-01-01')
            expect(input.calendarId).toBe(calendar)
        }
    )

    it('UTC 시각 문자열을 Instant로 변환한다', () => {
        expect(InstantFromInputSchema.parse('2023-06-18T12:12:34.567Z')).toBeInstanceOf(
            Temporal.Instant
        )
    })
    it('날짜 문자열을 PlainDate로 변환한다', () => {
        expect(PlainDateFromInputSchema.parse('2023-06-18')).toBeInstanceOf(Temporal.PlainDate)
    })

    it.each([
        { label: '시각이 아닌 문자열', input: 'not-an-instant' },
        { label: 'UTC가 아닌 시각 문자열', input: '2023-06-18T12:12:34+09:00' },
        { label: '숫자', input: 0 }
    ])('$label 입력은 Instant 검증에 실패한다', ({ input }) => {
        expect(InstantFromInputSchema.safeParse(input).success).toBe(false)
    })
    it.each([
        { label: '날짜가 아닌 문자열', input: 'not-a-date' },
        { label: '시각이 포함된 문자열', input: '2023-06-18T00:00:00Z' },
        { label: '불리언', input: false }
    ])('$label 입력은 PlainDate 검증에 실패한다', ({ input }) => {
        expect(PlainDateFromInputSchema.safeParse(input).success).toBe(false)
    })
})
