import type { Request } from 'express'

// 성공 로그와 예외 로그가 같은 기준 시각으로 처리 시간을 계산하게 한다.
// 요청 진입 시각은 인터셉터만 알 수 있으므로, 예외 필터도 읽을 수 있게 WeakMap으로 공유한다.
// WeakMap에 두면 `express.Request` 객체를 직접 수정하지 않아도 된다.
// 전역 타입 확장도 필요 없고, 같은 필드 이름을 쓰는 다른 미들웨어와 부딪힐 일도 없다.
const startTimestamps = new WeakMap<Request, number>()

export function markRequestStart(request: Request): void {
    startTimestamps.set(request, Date.now())
}

export function elapsedSinceRequestStart(request: Request): number {
    const start = startTimestamps.get(request)
    return start === undefined ? 0 : Date.now() - start
}
