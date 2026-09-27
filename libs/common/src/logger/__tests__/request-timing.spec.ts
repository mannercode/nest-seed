import type { Request } from 'express'
import { elapsedSinceRequestStart, markRequestStart } from '../index.js'

describe('request-timing', () => {
    let now: number
    beforeEach(() => {
        now = 0
        vi.spyOn(performance, 'now').mockImplementation(() => now)
    })
    it('서로 다른 시각에 시작한 요청은 각자의 경과 시간을 유지한다', () => {
        const reqA = {} as Request
        const reqB = {} as Request

        markRequestStart(reqA)
        now = 50
        markRequestStart(reqB)

        const elapsedB = elapsedSinceRequestStart(reqB)
        const elapsedA = elapsedSinceRequestStart(reqA)

        expect(elapsedA - elapsedB).toBe(50)
    })

    describe('요청의 시작 시각을 기록하고 30ms가 지났으면', () => {
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

    it('시작 시각을 기록하지 않은 요청은 경과 시간으로 0을 반환한다', () => {
        const req = {} as Request
        expect(elapsedSinceRequestStart(req)).toBe(0)
    })
})
