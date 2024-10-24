import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { DateRange } from '../types'

describe('types', () => {
    it('DateRange', async () => {
        const plain = {
            start: '2023-01-01',
            end: '2023-12-31'
        }

        const dateRange = plainToInstance(DateRange, plain)
        const errors = await validate(dateRange)

        expect(errors.length).toBe(0)
        expect(dateRange.start).toBeInstanceOf(Date)
        expect(dateRange.end).toBeInstanceOf(Date)
    })
})
