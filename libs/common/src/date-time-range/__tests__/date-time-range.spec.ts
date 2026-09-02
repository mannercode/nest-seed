import { DateTimeRange } from '../index.js'

describe('DateTimeRange', () => {
    const instant = (value: string) => Temporal.Instant.from(value)

    describe('create', () => {
        it('start와 end가 주어지면 그대로 DateTimeRange를 생성한다', () => {
            const start = instant('2023-01-01T00:00:00Z')
            const end = instant('2023-01-02T00:00:00Z')

            expect(DateTimeRange.create({ end, start })).toEqual({ end, start })
        })

        it('start와 days가 주어지면 days만큼 더한 end를 갖는다', () => {
            const start = instant('2023-01-01T00:00:00Z')
            const result = DateTimeRange.create({ days: 2, start })

            expect(result).toEqual({ end: instant('2023-01-03T00:00:00Z'), start })
        })

        it('start와 minutes가 주어지면 minutes만큼 더한 end를 갖는다', () => {
            const start = instant('2023-01-01T12:00:00Z')
            const result = DateTimeRange.create({ minutes: 30, start })

            expect(result).toEqual({ end: instant('2023-01-01T12:30:00Z'), start })
        })

        it('duration이 0이면 start와 end가 같다', () => {
            const start = instant('2023-01-01T12:00:00Z')

            expect(DateTimeRange.create({ days: 0, start })).toEqual({ end: start, start })
        })

        it('인자가 비어 있으면 예외를 던진다', () => {
            expect(() => DateTimeRange.create({})).toThrow('Invalid options provided.')
        })

        it('start만 주어지면 예외를 던진다', () => {
            expect(() => DateTimeRange.create({ start: instant('2023-01-01T00:00:00Z') })).toThrow(
                'Invalid options provided.'
            )
        })

        it('days와 minutes를 함께 주면 두 값이 합산된다', () => {
            const start = instant('2023-01-01T00:00:00Z')
            const result = DateTimeRange.create({ days: 1, minutes: 30, start })

            expect(result.end.epochMilliseconds - start.epochMilliseconds).toBe(
                24 * 60 * 60 * 1000 + 30 * 60 * 1000
            )
        })

        it('days가 음수이면 start 이전 시점의 범위를 만든다', () => {
            const start = instant('2023-01-10T00:00:00Z')
            const result = DateTimeRange.create({ days: -3, start })

            expect(result.end).toEqual(instant('2023-01-07T00:00:00Z'))
        })

        it('end만 주어지면 예외를 던진다', () => {
            expect(() => DateTimeRange.create({ end: instant('2023-01-01T00:00:00Z') })).toThrow(
                'Invalid options provided.'
            )
        })
    })
})
