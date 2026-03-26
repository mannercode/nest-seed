import { DateUtil } from '../date'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        // 문자열이 YYYYMMDDHHmm 형식일 때
        describe('when the string is in YYYYMMDDHHmm format', () => {
            // Date로 변환한다
            it('converts it to a Date', () => {
                const date = DateUtil.fromYMD('199901020930')
                expect(date).toEqual(new Date(1999, 0, 2, 9, 30))
            })
        })

        // 문자열이 YYYYMMDD 형식일 때
        describe('when the string is in YYYYMMDD format', () => {
            // Date로 변환한다
            it('converts it to a Date', () => {
                const date = DateUtil.fromYMD('19990102')
                expect(date).toEqual(new Date(1999, 0, 2))
            })
        })

        // 형식이 유효하지 않을 때
        describe('when the format is invalid', () => {
            // 예외를 던진다
            it('throws', () => {
                expect(() => DateUtil.fromYMD('')).toThrow()
            })
        })
    })

    describe('toYMD', () => {
        // Date 객체를 YYYYMMDD 형식 문자열로 변환한다
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

        // 배열에서 가장 이른 날짜를 반환한다
        it('returns the earliest date in an array', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        // 배열에서 가장 늦은 날짜를 반환한다
        it('returns the latest date in an array', () => {
            const date = DateUtil.latest(dates)
            expect(date).toEqual(new Date('2022-01-03T15:30:00Z'))
        })

        // 배열이 비어있을 때
        describe('when the array is empty', () => {
            // earliest는 Invalid Date를 반환한다
            it('returns an invalid date for earliest', () => {
                const date = DateUtil.earliest([])
                expect(Number.isNaN(date.getTime())).toBe(true)
            })

            // latest는 Invalid Date를 반환한다
            it('returns an invalid date for latest', () => {
                const date = DateUtil.latest([])
                expect(Number.isNaN(date.getTime())).toBe(true)
            })
        })
    })

    describe('now', () => {
        // 현재 날짜를 반환한다
        it('returns the current date', () => {
            const before = Date.now()

            const now = DateUtil.now().getTime()

            const after = Date.now()

            expect(now >= before && now <= after).toBe(true)
        })
    })

    describe('add', () => {
        // 지정한 오프셋이 적용된 날짜를 반환한다
        it('returns the date with the specified offset', () => {
            const base = new Date('2020-01-01T00:00:00Z')
            const updatedDate = DateUtil.add({ base, days: 5, hours: 5, minutes: 5, seconds: 5 })

            expect(updatedDate).toEqual(new Date('2020-01-06T05:05:05Z'))
        })

        // base가 제공되지 않을 때
        describe('when base is not provided', () => {
            // 현재 시간을 사용한다
            it('uses now', () => {
                const before = Date.now()

                const date = DateUtil.add({})

                const after = Date.now()

                expect(date.getTime() >= before && date.getTime() <= after).toBe(true)
            })
        })
    })
})
