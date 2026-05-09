import type { Request } from 'express'

// request duration 에 대한 component 간 contract: HttpSuccessLoggerInterceptor
// (request 진입은 보지만 exception flow 는 못 봄) 가 시작을 mark 하고,
// HttpExceptionLoggerFilter (exception flow 는 보지만 진입은 못 봄) 가
// elapsed time 을 읽는다. timestamp 를 WeakMap 에 두면 express.Request
// object 를 건드리지 않아도 된다 — global type augmentation 도, 같은
// field 이름을 쓰는 다른 middleware 와 부딪힐 위험도 없다.
const startTimestamps = new WeakMap<Request, number>()

export function markRequestStart(request: Request): void {
    startTimestamps.set(request, Date.now())
}

export function elapsedSinceRequestStart(request: Request): number {
    const start = startTimestamps.get(request)
    return start === undefined ? 0 : Date.now() - start
}
