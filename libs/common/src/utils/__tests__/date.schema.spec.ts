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

    it('지원 입력을 의미에 맞는 Temporal 타입으로 변환한다', () => {
        expect(InstantFromInputSchema.parse('2023-06-18T12:12:34.567Z')).toBeInstanceOf(
            Temporal.Instant
        )
        expect(PlainDateFromInputSchema.parse('2023-06-18')).toBeInstanceOf(Temporal.PlainDate)
    })

    it('잘못된 날짜 입력을 validation issue로 반환한다', () => {
        expect(InstantFromInputSchema.safeParse('not-an-instant').success).toBe(false)
        expect(PlainDateFromInputSchema.safeParse('not-a-date').success).toBe(false)
        expect(InstantFromInputSchema.safeParse('2023-06-18T12:12:34+09:00').success).toBe(false)
        expect(PlainDateFromInputSchema.safeParse('2023-06-18T00:00:00Z').success).toBe(false)
        expect(InstantFromInputSchema.safeParse(0).success).toBe(false)
        expect(PlainDateFromInputSchema.safeParse(false).success).toBe(false)
    })
})
