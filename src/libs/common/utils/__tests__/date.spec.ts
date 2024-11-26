import {
    addDays,
    addMinutes,
    convertDateToString,
    convertStringToDate,
    Exception,
    findMaxDate,
    findMinDate,
    millisecsToString,
    stringToMillisecs
} from 'common'

describe('common/utils/date', () => {
    it('stringToMillisecs', () => {
        expect(stringToMillisecs('30m')).toEqual(30 * 60 * 1000)
        expect(stringToMillisecs('45s')).toEqual(45 * 1000)
        expect(stringToMillisecs('1d')).toEqual(24 * 60 * 60 * 1000)
        expect(stringToMillisecs('2h')).toEqual(2 * 60 * 60 * 1000)
        expect(stringToMillisecs('1d 2h')).toEqual((24 + 2) * 60 * 60 * 1000)
        expect(stringToMillisecs('1d2h')).toEqual((24 + 2) * 60 * 60 * 1000)
        expect(stringToMillisecs('-30s')).toEqual(-30 * 1000)
        expect(stringToMillisecs('0.5s')).toEqual(0.5 * 1000)
        expect(stringToMillisecs('500ms')).toEqual(500)
        expect(() => stringToMillisecs('2z')).toThrow(Exception)
    })

    it('millisecsToString', () => {
        expect(millisecsToString(30 * 60 * 1000)).toEqual('30m')
        expect(millisecsToString(45 * 1000)).toEqual('45s')
        expect(millisecsToString(24 * 60 * 60 * 1000)).toEqual('1d')
        expect(millisecsToString(2 * 60 * 60 * 1000)).toEqual('2h')
        expect(millisecsToString((24 + 2) * 60 * 60 * 1000)).toEqual('1d2h')
        expect(millisecsToString(500)).toEqual('500ms')
        expect(millisecsToString(0)).toEqual('0ms')
        expect(millisecsToString(-30 * 1000)).toEqual('-30s')
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
        const date = convertStringToDate('199901020930')

        expect(date.getFullYear()).toEqual(1999)
        expect(date.getMonth()).toEqual(0)
        expect(date.getDate()).toEqual(2)
        expect(date.getHours()).toEqual(9)
        expect(date.getMinutes()).toEqual(30)

        const callback = () => convertStringToDate('')
        expect(callback).toThrow()
    })

    it('convertDateToString', () => {
        const string = convertDateToString(new Date('1999-01-02'))

        expect(string).toEqual('19990102')
    })
})
