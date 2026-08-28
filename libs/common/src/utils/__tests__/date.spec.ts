import { DateUtil } from '../date'

describe('DateUtil', () => {
    describe('earliest, latest', () => {
        const dates = [
            new Date('2022-01-01T12:00:00Z'),
            new Date('2022-01-03T15:30:00Z'),
            new Date('2022-01-02T09:20:00Z')
        ]

        it('earliest는 가장 이른 날짜를 반환한다', () => {
            const date = DateUtil.earliest(dates)
            expect(date).toEqual(new Date('2022-01-01T12:00:00Z'))
        })

        it('latest는 가장 늦은 날짜를 반환한다', () => {
            const date = DateUtil.latest(dates)
            expect(date).toEqual(new Date('2022-01-03T15:30:00Z'))
        })

        it('earliest는 빈 배열에 Invalid Date를 반환한다', () => {
            const date = DateUtil.earliest([])
            expect(Number.isNaN(date.getTime())).toBe(true)
        })

        it('latest는 빈 배열에 Invalid Date를 반환한다', () => {
            const date = DateUtil.latest([])
            expect(Number.isNaN(date.getTime())).toBe(true)
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

        it('음수 단위는 과거 방향으로 더한다', () => {
            const base = new Date('2020-06-15T12:00:00Z')
            const result = DateUtil.add({ base, days: -3, hours: -2 })

            expect(result).toEqual(new Date('2020-06-12T10:00:00Z'))
        })

        it('양수와 음수 단위가 섞이면 합산해 더한다', () => {
            const base = new Date('2020-06-15T12:00:00Z')
            const result = DateUtil.add({ base, days: 1, hours: -3, minutes: 30 })

            expect(result).toEqual(new Date('2020-06-16T09:30:00Z'))
        })

        // DST 경계 동작은 환경의 TZ에 의존하므로 add()가 절대 ms 기준으로 동작한다는 사실만 단언한다.
        it('DST와 무관하게 절대 ms 기준으로 더한다', () => {
            const base = new Date('2020-03-08T00:00:00Z')
            const result = DateUtil.add({ base, hours: 24 })

            expect(result.getTime() - base.getTime()).toBe(24 * 60 * 60 * 1000)
        })
    })
})
