import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from '../date-time-range'

describe('DateTimeRange', () => {
    describe('검증', () => {
        it('유효한 날짜 문자열을 Date 객체로 변환하고 검증을 통과한다', () => {
            const plainData = { end: '2023-01-02T00:00:00Z', start: '2023-01-01T00:00:00Z' }

            const instance = plainToInstance(DateTimeRange, plainData)

            expect(instance.start).toBeInstanceOf(Date)
            expect(instance.end).toBeInstanceOf(Date)

            const errors = validateSync(instance)
            expect(errors).toHaveLength(0)
        })

        it('유효하지 않은 날짜 문자열은 검증에 실패한다', () => {
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

describe('PartialDateTimeRange', () => {
    it('start와 end가 모두 선택적이며 빈 객체로도 검증을 통과한다', () => {
        const instance = plainToInstance(PartialDateTimeRange, {})

        expect(instance.start).toBeUndefined()
        expect(instance.end).toBeUndefined()

        const errors = validateSync(instance)
        expect(errors).toHaveLength(0)
    })

    it('start와 end 문자열을 Date 객체로 변환한다', () => {
        const instance = plainToInstance(PartialDateTimeRange, {
            end: '2023-01-02T00:00:00Z',
            start: '2023-01-01T00:00:00Z'
        })

        expect(instance.start).toBeInstanceOf(Date)
        expect(instance.end).toBeInstanceOf(Date)

        const errors = validateSync(instance)
        expect(errors).toHaveLength(0)
    })
})
