import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from 'common'

describe('DateTimeRange', () => {
    describe('validation', () => {
        it('converts strings to Dates and passes validation for valid date strings', () => {
            const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

            const instance = plainToInstance(DateTimeRange, plainData)

            expect(instance.start).toBeInstanceOf(Date)
            expect(instance.end).toBeInstanceOf(Date)

            const errors = validateSync(instance)
            expect(errors).toHaveLength(0)
        })

        it('fails validation for an invalid date string', () => {
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

    describe('create', () => {
        it('creates a DateTimeRange from start and end', () => {
            const result = DateTimeRange.create({
                start: new Date('2023-01-01'),
                end: new Date('2023-01-02')
            })
            expect(result).toEqual({ start: new Date('2023-01-01'), end: new Date('2023-01-02') })
        })

        it('creates a DateTimeRange from start and days', () => {
            const result = DateTimeRange.create({ start: new Date('2023-01-01'), days: 2 })
            expect(result).toEqual({ start: new Date('2023-01-01'), end: new Date('2023-01-03') })
        })

        it('creates a DateTimeRange from start and minutes', () => {
            const result = DateTimeRange.create({
                start: new Date('2023-01-01T12:00'),
                minutes: 30
            })
            expect(result).toEqual({
                start: new Date('2023-01-01T12:00'),
                end: new Date('2023-01-01T12:30')
            })
        })

        it('throws for missing start and end', () => {
            const throwException = () => DateTimeRange.create({})
            expect(throwException).toThrow('Invalid options provided.')
        })

        it('throws for missing duration when only start is provided', () => {
            const throwException = () => DateTimeRange.create({ start: new Date() })
            expect(throwException).toThrow('Invalid options provided.')
        })
    })
})

describe('PartialDateTimeRange', () => {
    it('converts strings to Dates and passes validation for valid date strings', () => {
        const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

        const instance = plainToInstance(PartialDateTimeRange, plainData)

        expect(instance.start).toBeInstanceOf(Date)
        expect(instance.end).toBeInstanceOf(Date)

        const errors = validateSync(instance)
        expect(errors).toHaveLength(0)
    })
})
