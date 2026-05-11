import type { Request } from 'express'

// 요청 처리 시간을 두 컴포넌트가 함께 본다.
// `HttpSuccessLoggerInterceptor` 는 요청 진입은 알지만 예외 흐름은 못 보고,
// `HttpExceptionLoggerFilter` 는 예외 흐름은 알지만 진입은 못 본다. 그래서
// 인터셉터가 시작 시각을 표시해 두면, 필터가 그 값을 읽어 경과 시간을 잰다.
// 시작 시각을 `WeakMap` 에 두면 `express.Request` 객체를 직접 건드리지 않아도
// 된다. 전역 타입 확장도 필요 없고, 같은 필드 이름을 쓰는 다른 미들웨어와
// 부딪힐 일도 없다.
const startTimestamps = new WeakMap<Request, number>()

export function markRequestStart(request: Request): void {
    startTimestamps.set(request, Date.now())
}

export function elapsedSinceRequestStart(request: Request): number {
    const start = startTimestamps.get(request)
    return start === undefined ? 0 : Date.now() - start
}
