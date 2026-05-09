import { DateUtil } from '../date'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        describe('문자열이 YYYYMMDDHHmm 형식일 때', () => {
            it('Date로 변환한다', () => {
                const date = DateUtil.fromYMD('199901020930')
                expect(date).toEqual(new Date(1999, 0, 2, 9, 30))
            })
        })

        describe('문자열이 YYYYMMDD 형식일 때', () => {
            it('Date로 변환한다', () => {
                const date = DateUtil.fromYMD('19990102')
                expect(date).toEqual(new Date(1999, 0, 2))
            })
        })

        describe('형식이 유효하지 않을 때', () => {
            it('예외를 던진다', () => {
                expect(() => DateUtil.fromYMD('')).toThrow()
            })
        })
    })

    describe('toYMD', () => {
        it('Date 객체를 YYYYMMDD 형식 문자열로 변환한다', () => {
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

        it('배열에서 가장 이른 날짜를 반환한다', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        it('배열에서 가장 늦은 날짜를 반환한다', () => {
            const date = DateUtil.latest(dates)
            expect(date).toEqual(new Date('2022-01-03T15:30:00Z'))
        })

        describe('배열이 비어있을 때', () => {
            it('earliest는 Invalid Date를 반환한다', () => {
                const date = DateUtil.earliest([])
                expect(Number.isNaN(date.getTime())).toBe(true)
            })

            it('latest는 Invalid Date를 반환한다', () => {
                const date = DateUtil.latest([])
                expect(Number.isNaN(date.getTime())).toBe(true)
            })
        })
    })

    describe('now', () => {
        it('현재 날짜를 반환한다', () => {
            const before = Date.now()

            const now = DateUtil.now().getTime()

            const after = Date.now()

            expect(now >= before && now <= after).toBe(true)
        })
    })

    describe('add', () => {
        it('지정한 오프셋이 적용된 날짜를 반환한다', () => {
            const base = new Date('2020-01-01T00:00:00Z')
            const updatedDate = DateUtil.add({ base, days: 5, hours: 5, minutes: 5, seconds: 5 })

            expect(updatedDate).toEqual(new Date('2020-01-06T05:05:05Z'))
        })

        describe('base가 제공되지 않을 때', () => {
            it('현재 시간을 사용한다', () => {
                const before = Date.now()

                const date = DateUtil.add({})

                const after = Date.now()

                expect(date.getTime() >= before && date.getTime() <= after).toBe(true)
            })
        })
    })
})
