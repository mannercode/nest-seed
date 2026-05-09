import { DateUtil } from '../date'

describe('DateUtil', () => {
    describe('fromYMD', () => {
        it('YYYYMMDDHHmm 형식 문자열을 Date로 변환한다', () => {
            const date = DateUtil.fromYMD('199901020930')
            expect(date).toEqual(new Date(1999, 0, 2, 9, 30))
        })

        it('YYYYMMDD 형식 문자열을 Date로 변환한다', () => {
            const date = DateUtil.fromYMD('19990102')
            expect(date).toEqual(new Date(1999, 0, 2))
        })

        it('형식이 유효하지 않으면 예외를 던진다', () => {
            expect(() => DateUtil.fromYMD('')).toThrow()
        })

        it.todo('잘못된 월(13, 00)은 다음/이전 달로 자동 보정된다')
    })

    describe('toYMD', () => {
        it('Date를 YYYYMMDD 형식 문자열로 변환한다', () => {
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

        it('가장 이른 날짜를 반환한다', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        it('가장 늦은 날짜를 반환한다', () => {
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
        it('현재 시각을 반환한다', () => {
            const before = Date.now()

            const now = DateUtil.now().getTime()

            const after = Date.now()

            expect(now >= before && now <= after).toBe(true)
        })
    })

    describe('add', () => {
        it('주어진 오프셋만큼 더한 날짜를 반환한다', () => {
            const base = new Date('2020-01-01T00:00:00Z')
            const updatedDate = DateUtil.add({ base, days: 5, hours: 5, minutes: 5, seconds: 5 })

            expect(updatedDate).toEqual(new Date('2020-01-06T05:05:05Z'))
        })

        it('base가 없으면 현재 시각을 기준으로 한다', () => {
            const before = Date.now()

            const date = DateUtil.add({})

            const after = Date.now()

            expect(date.getTime() >= before && date.getTime() <= after).toBe(true)
        })

        it.todo('음수 단위는 과거 방향으로 더한다')

        it.todo('양수와 음수 단위가 섞이면 합산해 더한다')

        it.todo('DST 경계를 넘으면 시계 시각이 1시간 어긋난다')
    })
})
