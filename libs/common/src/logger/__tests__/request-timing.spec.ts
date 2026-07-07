import type { Request } from 'express'
import { elapsedSinceRequestStart, markRequestStart } from '../request-timing'

describe('request-timing', () => {
    it('동시에 진행되는 두 요청은 각자의 시작 시각을 독립적으로 갖는다', async () => {
        const reqA = {} as Request
        const reqB = {} as Request

        markRequestStart(reqA)
        await new Promise((r) => setTimeout(r, 50))
        markRequestStart(reqB)

        // 시작 시각이 공유된다면 reqB 마크가 reqA의 시각을 덮어써 두 elapsed의 차이가 대기 시간만큼 벌어질 수 없다.
        // elapsedB를 먼저 측정하면 측정 간 시차가 차이를 키우는 쪽으로만 작용해 하한 단언이 부하와 무관하게 성립한다.
        const elapsedB = elapsedSinceRequestStart(reqB)
        const elapsedA = elapsedSinceRequestStart(reqA)

        expect(elapsedA - elapsedB).toBeGreaterThanOrEqual(40)
    })

    it('같은 요청에 markRequestStart를 두 번 호출하면 두 번째 시각으로 덮어쓴다', async () => {
        const req = {} as Request

        markRequestStart(req)
        await new Promise((r) => setTimeout(r, 30))

        const elapsedBefore = elapsedSinceRequestStart(req)
        expect(elapsedBefore).toBeGreaterThanOrEqual(20)

        markRequestStart(req)
        const elapsedAfter = elapsedSinceRequestStart(req)
        expect(elapsedAfter).toBeLessThan(elapsedBefore)
    })

    it('마크되지 않은 요청에 대해서는 0을 반환한다', () => {
        const req = {} as Request
        expect(elapsedSinceRequestStart(req)).toBe(0)
    })
})
