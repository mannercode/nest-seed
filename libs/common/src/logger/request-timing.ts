import type { Request } from 'express'

// 요청 객체를 수정하지 않고 성공 인터셉터와 예외 필터가 같은 시작 시각을 공유한다.
const startTimestamps = new WeakMap<Request, number>()

export function markRequestStart(request: Request): void {
    startTimestamps.set(request, Date.now())
}

export function elapsedSinceRequestStart(request: Request): number {
    const start = startTimestamps.get(request)
    return start === undefined ? 0 : Date.now() - start
}
