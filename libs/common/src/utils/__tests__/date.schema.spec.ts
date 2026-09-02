import { InstantFromInputSchema, PlainDateFromInputSchema } from '../index.js'

describe('Temporal input schemas', () => {
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
