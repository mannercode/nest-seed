import { DateTimeRange } from '../date-time-range.js'

describe('DateTimeRange', () => {
    describe('create', () => {
        it('start와 end가 주어지면 그대로 DateTimeRange를 생성한다', () => {
            const result = DateTimeRange.create({
                end: new Date('2023-01-02'),
                start: new Date('2023-01-01')
            })
            expect(result).toEqual({ end: new Date('2023-01-02'), start: new Date('2023-01-01') })
        })

        it('start와 days가 주어지면 days만큼 더한 end를 갖는다', () => {
            const result = DateTimeRange.create({ days: 2, start: new Date('2023-01-01') })
            expect(result).toEqual({ end: new Date('2023-01-03'), start: new Date('2023-01-01') })
        })

        it('start와 minutes가 주어지면 minutes만큼 더한 end를 갖는다', () => {
            const result = DateTimeRange.create({
                minutes: 30,
                start: new Date('2023-01-01T12:00')
            })
            expect(result).toEqual({
                end: new Date('2023-01-01T12:30'),
                start: new Date('2023-01-01T12:00')
            })
        })

        it('duration이 0이면 start와 end가 같다', () => {
            const start = new Date('2023-01-01T12:00')
            const result = DateTimeRange.create({ days: 0, start })

            expect(result).toEqual({ end: start, start })
        })

        it('인자가 비어 있으면 예외를 던진다', () => {
            const throwException = () => DateTimeRange.create({})
            expect(throwException).toThrow('Invalid options provided.')
        })

        it('start만 주어지면 예외를 던진다', () => {
            const throwException = () => DateTimeRange.create({ start: new Date() })
            expect(throwException).toThrow('Invalid options provided.')
        })

        it('days와 minutes를 함께 주면 두 값이 합산된다', () => {
            const start = new Date('2023-01-01T00:00:00Z')
            const result = DateTimeRange.create({ days: 1, minutes: 30, start })

            expect(result.end.getTime() - start.getTime()).toBe(
                24 * 60 * 60 * 1000 + 30 * 60 * 1000
            )
        })

        it('days가 음수이면 start 이전 시점의 범위를 만든다', () => {
            const start = new Date('2023-01-10T00:00:00Z')
            const result = DateTimeRange.create({ days: -3, start })

            expect(result.end).toEqual(new Date('2023-01-07T00:00:00Z'))
        })

        it('end만 주어지면 예외를 던진다', () => {
            const throwException = () => DateTimeRange.create({ end: new Date() })
            expect(throwException).toThrow('Invalid options provided.')
        })
    })
})
