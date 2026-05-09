import { plainToInstance } from 'class-transformer'
import { validateSync } from 'class-validator'
import { DateTimeRange, PartialDateTimeRange } from '../date-time-range'

describe('DateTimeRange', () => {
    describe('validation', () => {
        describe('날짜 문자열이 유효할 때', () => {
            it('문자열을 Date로 변환하고 검증을 통과한다', () => {
                const plainData = { end: '2023-01-02T00:00:00Z', start: '2023-01-01T00:00:00Z' }

                const instance = plainToInstance(DateTimeRange, plainData)

                expect(instance.start).toBeInstanceOf(Date)
                expect(instance.end).toBeInstanceOf(Date)

                const errors = validateSync(instance)
                expect(errors).toHaveLength(0)
            })
        })

        describe('날짜 문자열이 유효하지 않을 때', () => {
            it('검증에 실패한다', () => {
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
        describe('start와 end가 제공될 때', () => {
            it('DateTimeRange를 생성한다', () => {
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

        describe('start와 days가 제공될 때', () => {
            it('DateTimeRange를 생성한다', () => {
                const result = DateTimeRange.create({ days: 2, start: new Date('2023-01-01') })
                expect(result).toEqual({
                    end: new Date('2023-01-03'),
                    start: new Date('2023-01-01')
                })
            })
        })

        describe('start와 minutes가 제공될 때', () => {
            it('DateTimeRange를 생성한다', () => {
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

        describe('start와 duration이 0일 때', () => {
            it('시작과 같은 종료 시각을 가진 DateTimeRange를 생성한다', () => {
                const start = new Date('2023-01-01T12:00')
                const result = DateTimeRange.create({ days: 0, start })

                expect(result).toEqual({ end: start, start })
            })
        })

        describe('start와 end가 제공되지 않을 때', () => {
            it('예외를 던진다', () => {
                const throwException = () => DateTimeRange.create({})
                expect(throwException).toThrow('Invalid options provided.')
            })
        })

        describe('start만 제공될 때', () => {
            it('예외를 던진다', () => {
                const throwException = () => DateTimeRange.create({ start: new Date() })
                expect(throwException).toThrow('Invalid options provided.')
            })
        })

        it.todo('days 와 minutes 를 모두 넘기면 두 값이 합산된 범위를 만든다')

        it.todo('days 가 음수면 start 이전의 범위가 만들어진다')

        it.todo('end 만 단독 제공되면 (start 없이) Invalid options 에러를 던진다')

        it.todo('Date 입력의 timezone 은 무시되고 UTC/일관 정렬되어 있다고 가정한다')
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
})
