import { DateUtil } from 'common'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        it('converts a YYYYMMDDHHmm format string to a Date', () => {
            const date = DateUtil.fromYMD('199901020930')
            expect(date.getFullYear()).toEqual(1999)
            expect(date.getMonth()).toEqual(0) // 1월은 0이다.
            expect(date.getDate()).toEqual(2)
            expect(date.getHours()).toEqual(9)
            expect(date.getMinutes()).toEqual(30)
        })

        it('converts a YYYYMMDD format string to a Date', () => {
            const date = DateUtil.fromYMD('19990102')
            expect(date.getFullYear()).toEqual(1999)
            expect(date.getMonth()).toEqual(0) // 1월은 0이다.
            expect(date.getDate()).toEqual(2)
        })

        it('throws an error for invalid format input', () => {
            expect(() => DateUtil.fromYMD('')).toThrow()
        })
    })

    describe('toYMD', () => {
        it('converts a Date object to a YYYYMMDD format string', () => {
            const dateString = DateUtil.toYMD(new Date('1999-01-02'))
            expect(dateString).toEqual('19990102')
        })
    })

    describe('earliest/latest', () => {
        const dates = [
            new Date('2022-01-01T12:00:00Z'),
            new Date('2022-01-03T15:30:00Z'),
            new Date('2022-01-02T09:20:00Z')
        ]

        it('finds the earliest date from an array', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        it('finds the latest date from an array', () => {
            const date = DateUtil.latest(dates)
            expect(date).toEqual(new Date('2022-01-03T15:30:00Z'))
        })
    })

    // TODO faketimer 사용해서 테스트
    describe('now', () => {
        it('returns now', () => {
            expect(DateUtil.now()).toBeDefined()
        })
    })

    describe('add', () => {
        it('returns the date with the specified offset', () => {
            const base = new Date('2020-01-01T00:00:00Z')
            const updatedDate = DateUtil.add({ base, days: 5, hours: 5, minutes: 5, seconds: 5 })

            expect(updatedDate).toEqual(new Date('2020-01-06T05:05:05Z'))
        })

        it('uses now when no base is provided', () => {
            const now = DateUtil.add({})

            expect(now).toBeDefined()
        })
    })
})
