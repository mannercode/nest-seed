import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from 'common'

describe('DateTimeRange', () => {
    // 문자열 날짜를 Date 객체로 변환하고 유효성 검사를 통과해야 함
    it('Should convert string dates to Date objects and pass validation', () => {
        const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

        const instance = plainToInstance(DateTimeRange, plainData)

        expect(instance.start).toBeInstanceOf(Date)
        expect(instance.end).toBeInstanceOf(Date)

        const errors = validateSync(instance)
        expect(errors).toHaveLength(0)
    })

    // 유효하지 않은 날짜 문자열은 변환 후 유효성 검사 실패해야 함
    it('Should fail validation if the date string is invalid', () => {
        const plainData = { start: 'invalid-date-string', end: '2023-01-02T00:00:00Z' }

        const instance = plainToInstance(DateTimeRange, plainData)

        expect(instance.start).toBeInstanceOf(Date)
        expect(isNaN(instance.start!.getTime())).toBe(true)

        const errors = validateSync(instance)
        expect(errors.length).toBeGreaterThan(0)
        expect(errors[0].property).toBe('start')
        expect(errors[0].constraints?.isDate).toBeDefined()
    })

    describe('create', () => {
        // start와 end가 주어졌을 때 DateTimeRange 생성해야 한다
        it('Should create DateTimeRange with start and end', () => {
            const result = DateTimeRange.create({
                start: new Date('2023-01-01'),
                end: new Date('2023-01-02')
            })
            expect(result).toEqual({ start: new Date('2023-01-01'), end: new Date('2023-01-02') })
        })

        // start와 days가 주어졌을 때 DateTimeRange 생성해야 한다
        it('Should create DateTimeRange with start and days', () => {
            const result = DateTimeRange.create({ start: new Date('2023-01-01'), days: 2 })
            expect(result).toEqual({ start: new Date('2023-01-01'), end: new Date('2023-01-03') })
        })

        // start와 minutes가 주어졌을 때 DateTimeRange 생성해야 한다*/
        it('Should create DateTimeRange with start and minutes', () => {
            const result = DateTimeRange.create({
                start: new Date('2023-01-01T12:00'),
                minutes: 30
            })
            expect(result).toEqual({
                start: new Date('2023-01-01T12:00'),
                end: new Date('2023-01-01T12:30')
            })
        })

        // start나 end가 제공되지 않았을 때 에러를 던져야 한다
        it('Should throw error if no start or end is provided', () => {
            const throwException = () => DateTimeRange.create({})
            expect(throwException).toThrow('Invalid options provided.')
        })

        // start만 제공되고 minutes이나 days 날짜가 없을 때 에러를 던져야 한다
        it('Should throw error if only start is provided without minutes or days', () => {
            const throwException = () => DateTimeRange.create({ start: new Date() })
            expect(throwException).toThrow('Invalid options provided.')
        })
    })
})

describe('PartialDateTimeRange', () => {
    // 문자열 날짜를 Date 객체로 변환하고 유효성 검사를 통과해야 함
    it('Should convert string dates to Date objects and pass validation', () => {
        const plainData = { start: '2023-01-01T00:00:00Z', end: '2023-01-02T00:00:00Z' }

        const instance = plainToInstance(PartialDateTimeRange, plainData)

        expect(instance.start).toBeInstanceOf(Date)
        expect(instance.end).toBeInstanceOf(Date)

        const errors = validateSync(instance)
        expect(errors).toHaveLength(0)
    })
})
