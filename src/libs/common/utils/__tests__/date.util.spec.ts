import { DateUtil } from 'common'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        describe('when the string is in YYYYMMDDHHmm format', () => {
            it('converts it to a Date', () => {
                const date = DateUtil.fromYMD('199901020930')
                expect(date).toEqual(new Date(1999, 0, 2, 9, 30))
            })
        })

        describe('when the string is in YYYYMMDD format', () => {
            it('converts it to a Date', () => {
                const date = DateUtil.fromYMD('19990102')
                expect(date).toEqual(new Date(1999, 0, 2))
            })
        })

        describe('when the format is invalid', () => {
            it('throws', () => {
                expect(() => DateUtil.fromYMD('')).toThrow()
            })
        })
    })

    describe('toYMD', () => {
        it('converts a Date object to a YYYYMMDD format string', () => {
            const dateString = DateUtil.toYMD(new Date('1999-01-02'))
            expect(dateString).toEqual('19990102')
        })
    })

    describe('earliest and latest', () => {
        const dates = [
            new Date('2022-01-01T12:00:00Z'),
            new Date('2022-01-03T15:30:00Z'),
            new Date('2022-01-02T09:20:00Z')
        ]

        it('returns the earliest date in an array', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        it('returns the latest date in an array', () => {
            const date = DateUtil.latest(dates)
            expect(date).toEqual(new Date('2022-01-03T15:30:00Z'))
        })
    })

    describe('now', () => {
        it('returns the current date', () => {
            const before = Date.now()

            const now = DateUtil.now().getTime()

            const after = Date.now()

            expect(now >= before && now <= after).toBe(true)
        })
    })

    describe('add', () => {
        it('returns the date with the specified offset', () => {
            const base = new Date('2020-01-01T00:00:00Z')
            const updatedDate = DateUtil.add({ base, days: 5, hours: 5, minutes: 5, seconds: 5 })

            expect(updatedDate).toEqual(new Date('2020-01-06T05:05:05Z'))
        })

        describe('when base is not provided', () => {
            it('uses now', () => {
                const before = Date.now()

                const date = DateUtil.add({})

                const after = Date.now()

                expect(date.getTime() >= before && date.getTime() <= after).toBe(true)
            })
        })
    })
})
