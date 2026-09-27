import { DateTimeRange } from '../index.js'

describe('DateTimeRange', () => {
    const instant = (value: string) => Temporal.Instant.from(value)

    describe('create', () => {
        describe('시작과 끝 시각이 지정되어 있으면', () => {
            let start: Temporal.Instant
            let end: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-01T00:00:00Z')
                end = instant('2023-01-02T00:00:00Z')
                options = { end, start }
            })
            it('범위를 만들면 지정한 시작과 끝을 유지한다', () => {
                expect(DateTimeRange.create(options)).toEqual({ end, start })
            })
        })

        describe('시작 시각과 기간 2일이 지정되어 있으면', () => {
            let start: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-01T00:00:00Z')
                options = { days: 2, start }
            })
            it('범위를 만들면 시작에서 2일 뒤를 끝 시각으로 한다', () => {
                const result = DateTimeRange.create(options)

                expect(result).toEqual({ end: instant('2023-01-03T00:00:00Z'), start })
            })
        })

        describe('시작 시각과 기간 30분이 지정되어 있으면', () => {
            let start: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-01T12:00:00Z')
                options = { minutes: 30, start }
            })
            it('범위를 만들면 시작에서 30분 뒤를 끝 시각으로 한다', () => {
                const result = DateTimeRange.create(options)

                expect(result).toEqual({ end: instant('2023-01-01T12:30:00Z'), start })
            })
        })

        describe('시작 시각과 기간 0일이 지정되어 있으면', () => {
            let start: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-01T12:00:00Z')
                options = { days: 0, start }
            })
            it('범위를 만들면 시작과 끝 시각이 같다', () => {
                expect(DateTimeRange.create(options)).toEqual({ end: start, start })
            })
        })

        describe('범위 옵션이 비어 있으면', () => {
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                options = {}
            })
            it('범위를 만들면 예외를 던진다', () => {
                expect(() => DateTimeRange.create(options)).toThrow(
                    expect.objectContaining({ status: 500, cause: 'Invalid options provided.' })
                )
            })
        })

        describe('시작 시각만 지정되어 있으면', () => {
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                options = { start: instant('2023-01-01T00:00:00Z') }
            })
            it('범위를 만들면 예외를 던진다', () => {
                expect(() => DateTimeRange.create(options)).toThrow(
                    expect.objectContaining({ status: 500, cause: 'Invalid options provided.' })
                )
            })
        })

        describe('기간에 1일과 30분이 함께 지정되어 있으면', () => {
            let start: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-01T00:00:00Z')
                options = { days: 1, minutes: 30, start }
            })
            it('범위를 만들면 두 기간을 합산한다', () => {
                const result = DateTimeRange.create(options)

                expect(result.end.epochMilliseconds - start.epochMilliseconds).toBe(
                    24 * 60 * 60 * 1000 + 30 * 60 * 1000
                )
            })
        })

        describe('기간이 음수 3일이면', () => {
            let start: Temporal.Instant
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                start = instant('2023-01-10T00:00:00Z')
                options = { days: -3, start }
            })
            it('범위를 만들면 시작보다 3일 전을 끝 시각으로 한다', () => {
                const result = DateTimeRange.create(options)

                expect(result.end).toEqual(instant('2023-01-07T00:00:00Z'))
            })
        })

        describe('끝 시각만 지정되어 있으면', () => {
            let options: Parameters<typeof DateTimeRange.create>[0]
            beforeEach(() => {
                options = { end: instant('2023-01-01T00:00:00Z') }
            })
            it('범위를 만들면 예외를 던진다', () => {
                expect(() => DateTimeRange.create(options)).toThrow(
                    expect.objectContaining({ status: 500, cause: 'Invalid options provided.' })
                )
            })
        })
    })
})
