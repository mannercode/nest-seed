import type { Request } from 'express'
import { elapsedSinceRequestStart, markRequestStart } from '../index.js'

describe('request-timing', () => {
    let now: number
    beforeEach(() => {
        now = 0
        vi.spyOn(performance, 'now').mockImplementation(() => now)
    })
    describe('두 요청이 50ms 간격으로 시작되었으면', () => {
        let reqA: Request
        let reqB: Request
        beforeEach(() => {
            reqA = {} as Request
            reqB = {} as Request

            markRequestStart(reqA)
            now = 50
            markRequestStart(reqB)
        })
        it('경과 시간을 조회하면 두 요청의 차이가 50ms이다', () => {
            const elapsedB = elapsedSinceRequestStart(reqB)
            const elapsedA = elapsedSinceRequestStart(reqA)

            expect(elapsedA - elapsedB).toBe(50)
        })
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
