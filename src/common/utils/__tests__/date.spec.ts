import { Exception } from 'common'
import {
    addDays,
    addMinutes,
    convertDateToString,
    convertStringToDate,
    findMaxDate,
    findMinDate,
    millisecsToString,
    stringToMillisecs
} from '..'

describe('common/utils/date', () => {
    describe('stringToMillisecs', () => {
        it('30m == 30*60*1000', () => {
            const result = stringToMillisecs('30m')
            expect(result).toEqual(30 * 60 * 1000)
        })

        it('45s == 45*1000', () => {
            const result = stringToMillisecs('45s')
            expect(result).toEqual(45 * 1000)
        })

        it('1d == 24*60*60*1000', () => {
            const result = stringToMillisecs('1d')
            expect(result).toEqual(24 * 60 * 60 * 1000)
        })

        it('2h == 2*60*60*1000', () => {
            const result = stringToMillisecs('2h')
            expect(result).toEqual(2 * 60 * 60 * 1000)
        })

        it('1d 2h == (24+2)*60*60*1000', () => {
            const result = stringToMillisecs('1d 2h')
            expect(result).toEqual((24 + 2) * 60 * 60 * 1000)
        })

        it('1d2h == (24+2)*60*60*1000', () => {
            const result = stringToMillisecs('1d2h')
            expect(result).toEqual((24 + 2) * 60 * 60 * 1000)
        })

        it('-30s == -30*1000', () => {
            const result = stringToMillisecs('-30s')
            expect(result).toEqual(-30 * 1000)
        })

        it('0.5s == 0.5*1000', () => {
            const result = stringToMillisecs('0.5s')
            expect(result).toEqual(0.5 * 1000)
        })

        it('500ms == 500', () => {
            const result = stringToMillisecs('500ms')
            expect(result).toEqual(500)
        })

        it('throws an Exception if the format is invalid', () => {
            expect(() => stringToMillisecs('2z')).toThrow(Exception)
        })
    })

    describe('millisecsToString', () => {
        it('30*60*1000 == 30m', () => {
            const result = millisecsToString(30 * 60 * 1000)
            expect(result).toEqual('30m')
        })

        it('45*1000 == 45s', () => {
            const result = millisecsToString(45 * 1000)
            expect(result).toEqual('45s')
        })

        it('24*60*60*1000 == 1d', () => {
            const result = millisecsToString(24 * 60 * 60 * 1000)
            expect(result).toEqual('1d')
        })

        it('2*60*60*1000 == 2h', () => {
            const result = millisecsToString(2 * 60 * 60 * 1000)
            expect(result).toEqual('2h')
        })

        it('(24+2)*60*60*1000 == 1d2h', () => {
            const result = millisecsToString((24 + 2) * 60 * 60 * 1000)
            expect(result).toEqual('1d2h')
        })

        it('500ms == 500', () => {
            const result = millisecsToString(500)
            expect(result).toEqual('500ms')
        })

        it('0ms == 0', () => {
            const result = millisecsToString(0)
            expect(result).toEqual('0ms')
        })

        it('-30*1000 == -30s', () => {
            const result = millisecsToString(-30 * 1000)
            expect(result).toEqual('-30s')
        })
    })

    it('addDays', () => {
        const baseDate = new Date('2020-01-01T00:00:00Z')
        const daysToAdd = 2
        const resultDate = addDays(baseDate, daysToAdd)

        const expectedDate = new Date('2020-01-03T00:00:00Z')
        expect(resultDate).toEqual(expectedDate)
    })

    it('addMinutes', () => {
        const baseDate = new Date('2020-01-01T00:00:00Z')
        const minutesToAdd = 90
        const resultDate = addMinutes(baseDate, minutesToAdd)

        const expectedDate = new Date('2020-01-01T01:30:00Z')
        expect(resultDate).toEqual(expectedDate)
    })

    describe('Date Utilities', () => {
        const dates = [
            new Date('2022-01-01T12:00:00Z'),
            new Date('2022-01-03T15:30:00Z'),
            new Date('2022-01-02T09:20:00Z')
        ]

        it('finds the minimum date in an array of dates', () => {
            const minDate = findMinDate(dates)
            const expectedDate = new Date('2022-01-01T12:00:00Z')
            expect(minDate).toEqual(expectedDate)
        })

        it('finds the maximum date in an array of dates', () => {
            const maxDate = findMaxDate(dates)
            const expectedDate = new Date('2022-01-03T15:30:00Z')
            expect(maxDate).toEqual(expectedDate)
        })
    })

    it('convertStringToDate', () => {
        const date = convertStringToDate('19990102')

        expect(date.getFullYear()).toEqual(1999)
        expect(date.getMonth()).toEqual(0)
        expect(date.getDate()).toEqual(2)

        const callback = () => convertStringToDate('')
        expect(callback).toThrow()
    })

    it('convertDateToString', () => {
        const string = convertDateToString(new Date('1999-01-02'))

        expect(string).toEqual('19990102')
    })
})
