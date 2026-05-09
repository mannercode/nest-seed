import type { Request } from 'express'
import { elapsedSinceRequestStart, markRequestStart } from '../request-timing'

describe('request-timing', () => {
    it('동시에 진행되는 두 요청은 각자의 시작 시각을 독립적으로 갖는다', async () => {
        const reqA = {} as Request
        const reqB = {} as Request

        markRequestStart(reqA)
        await new Promise((r) => setTimeout(r, 20))
        markRequestStart(reqB)

        const elapsedA = elapsedSinceRequestStart(reqA)
        const elapsedB = elapsedSinceRequestStart(reqB)

        expect(elapsedA).toBeGreaterThanOrEqual(elapsedB)
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
