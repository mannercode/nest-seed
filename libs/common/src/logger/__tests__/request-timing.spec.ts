import type { Request } from 'express'
import { elapsedSinceRequestStart, markRequestStart } from '#common/logger'

describe('request-timing', () => {
    let now: number
    beforeEach(() => {
        now = 0
        vi.spyOn(performance, 'now').mockImplementation(() => now)
    })
    describe('두 요청이 서로 다른 시각에 시작하면', () => {
        let reqA: Request
        let reqB: Request
        beforeEach(() => {
            reqA = {} as Request
            reqB = {} as Request

            markRequestStart(reqA)
            now = 50
            markRequestStart(reqB)
        })
        it('두 경과 시간의 차이가 시작 시각 간격과 같다', () => {
            const elapsedB = elapsedSinceRequestStart(reqB)
            const elapsedA = elapsedSinceRequestStart(reqA)

            expect(elapsedA - elapsedB).toBe(50)
        })
    })

    describe('요청을 시작한 뒤 시간이 지나면', () => {
        let req: Request
        let elapsedBefore: number
        beforeEach(() => {
            req = {} as Request

            markRequestStart(req)
            now = 30

            elapsedBefore = elapsedSinceRequestStart(req)
            expect(elapsedBefore).toBe(30)
        })
        it('시작 시각을 다시 기록하면 경과 시간이 줄어든다', async () => {
            markRequestStart(req)
            const elapsedAfter = elapsedSinceRequestStart(req)
            expect(elapsedAfter).toBeLessThan(elapsedBefore)
        })
    })

    describe('요청의 시작 시각을 기록하지 않았으면', () => {
        let req: Request
        beforeEach(() => {
            req = {} as Request
        })
        it('경과 시간을 조회하면 0을 반환한다', () => {
            expect(elapsedSinceRequestStart(req)).toBe(0)
        })
    })
})
