import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from 'common'

describe('DateTimeRange', () => {
    describe('validation', () => {
        describe('when the date strings are valid', () => {
            it('converts strings to Dates and passes validation', () => {
                const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

                const instance = plainToInstance(DateTimeRange, plainData)

                expect(instance.start).toBeInstanceOf(Date)
                expect(instance.end).toBeInstanceOf(Date)

                const errors = validateSync(instance)
                expect(errors).toHaveLength(0)
            })
        })

        describe('when a date string is invalid', () => {
            it('fails validation', () => {
                const plainData = { start: 'invalid-date-string', end: '2023-01-02T00:00:00Z' }

                const instance = plainToInstance(DateTimeRange, plainData)

                expect(instance.start).toBeInstanceOf(Date)
                expect(isNaN(instance.start!.getTime())).toBe(true)

                const errors = validateSync(instance)
                expect(errors.length).toBeGreaterThan(0)
                expect(errors[0].property).toBe('start')
                expect(errors[0].constraints?.isDate).toBeDefined()
            })
        })
    })

    describe('create', () => {
        describe('when the start and end are provided', () => {
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({
                    start: new Date('2023-01-01'),
                    end: new Date('2023-01-02')
                })
                expect(result).toEqual({
                    start: new Date('2023-01-01'),
                    end: new Date('2023-01-02')
                })
            })
        })

        describe('when the start and days are provided', () => {
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({ start: new Date('2023-01-01'), days: 2 })
                expect(result).toEqual({
                    start: new Date('2023-01-01'),
                    end: new Date('2023-01-03')
                })
            })
        })

        describe('when the start and minutes are provided', () => {
            it('creates a DateTimeRange', () => {
                const result = DateTimeRange.create({
                    start: new Date('2023-01-01T12:00'),
                    minutes: 30
                })
                expect(result).toEqual({
                    start: new Date('2023-01-01T12:00'),
                    end: new Date('2023-01-01T12:30')
                })
            })
        })

        describe('when neither start nor end is provided', () => {
            it('throws an error', () => {
                const throwException = () => DateTimeRange.create({})
                expect(throwException).toThrow('Invalid options provided.')
            })
        })

        describe('when only the start is provided without a duration', () => {
            it('throws an error', () => {
                const throwException = () => DateTimeRange.create({ start: new Date() })
                expect(throwException).toThrow('Invalid options provided.')
            })
        })
    })
})

describe('PartialDateTimeRange', () => {
    describe('when the date strings are valid', () => {
        it('converts strings to Dates and passes validation', () => {
            const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

            const instance = plainToInstance(PartialDateTimeRange, plainData)

            expect(instance.start).toBeInstanceOf(Date)
            expect(instance.end).toBeInstanceOf(Date)

            const errors = validateSync(instance)
            expect(errors).toHaveLength(0)
        })
    })
})
