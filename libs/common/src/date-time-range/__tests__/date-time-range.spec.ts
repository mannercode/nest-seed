import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from '../date-time-range'

describe('DateTimeRange', () => {
    describe('validation', () => {
        // 날짜 문자열이 유효할 때
        describe('when the date strings are valid', () => {
            // 문자열을 Date로 변환하고 검증을 통과한다
            it('converts strings to Dates and passes validation', () => {
                const plainData = { end: '2023-01-02T00:00:00Z', start: '2023-01-01T00:00:00Z' }

                const instance = plainToInstance(DateTimeRange, plainData)

                expect(instance.start).toBeInstanceOf(Date)
                expect(instance.end).toBeInstanceOf(Date)

                const errors = validateSync(instance)
                expect(errors).toHaveLength(0)
            })
        })

        // 날짜 문자열이 유효하지 않을 때
        describe('when a date string is invalid', () => {
            // 검증에 실패한다
            it('fails validation', () => {
                const plainData = { end: '2023-01-02T00:00:00Z', start: 'invalid-date-string' }

                const instance = plainToInstance(DateTimeRange, plainData)

                expect(instance.start).toBeInstanceOf(Date)
                expect(isNaN(instance.start.getTime())).toBe(true)

                const errors = validateSync(instance)
                expect(errors.length).toBeGreaterThan(0)
                expect(errors[0].property).toBe('start')
                expect(errors[0].constraints?.isDate).toBeDefined()
            })
        })
    })

    describe('create', () => {
        // start와 end가 제공될 때
        describe('when start and end are provided', () => {
            // DateTimeRange를 생성한다
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({
                    end: new Date('2023-01-02'),
                    start: new Date('2023-01-01')
                })
                expect(result).toEqual({
                    end: new Date('2023-01-02'),
                    start: new Date('2023-01-01')
                })
            })
        })

        // start와 days가 제공될 때
        describe('when start and days are provided', () => {
            // DateTimeRange를 생성한다
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({ days: 2, start: new Date('2023-01-01') })
                expect(result).toEqual({
                    end: new Date('2023-01-03'),
                    start: new Date('2023-01-01')
                })
            })
        })

        // start와 minutes가 제공될 때
        describe('when start and minutes are provided', () => {
            // DateTimeRange를 생성한다
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({
                    minutes: 30,
                    start: new Date('2023-01-01T12:00')
                })
                expect(result).toEqual({
                    end: new Date('2023-01-01T12:30'),
                    start: new Date('2023-01-01T12:00')
                })
            })
        })

        // start와 duration이 0일 때
        describe('when start and zero duration are provided', () => {
            // 시작과 같은 종료 시각을 가진 DateTimeRange를 생성한다
            it('creates a DateTimeRange with the same start and end', () => {
                const start = new Date('2023-01-01T12:00')
                const result = DateTimeRange.create({ days: 0, start })

                expect(result).toEqual({ end: start, start })
            })
        })

        // start와 end가 제공되지 않을 때
        describe('when start and end are not provided', () => {
            // 예외를 던진다
            it('throws', () => {
                const throwException = () => DateTimeRange.create({})
                expect(throwException).toThrow('Invalid options provided.')
            })
        })

        // start만 제공될 때
        describe('when only start is provided', () => {
            // 예외를 던진다
            it('throws', () => {
                const throwException = () => DateTimeRange.create({ start: new Date() })
                expect(throwException).toThrow('Invalid options provided.')
            })
        })
    })
})

describe('PartialDateTimeRange', () => {
    // 날짜 문자열이 유효할 때
    describe('when the date strings are valid', () => {
        // 문자열을 Date로 변환하고 검증을 통과한다
        it('converts strings to Dates and passes validation', () => {
            const plainData = { end: '2023-01-02T00:00:00Z', start: '2023-01-01T00:00:00Z' }

            const instance = plainToInstance(PartialDateTimeRange, plainData)

            expect(instance.start).toBeInstanceOf(Date)
            expect(instance.end).toBeInstanceOf(Date)

            const errors = validateSync(instance)
            expect(errors).toHaveLength(0)
        })
    })
})
