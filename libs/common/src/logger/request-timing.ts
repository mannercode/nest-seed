import type { Request } from 'express'

// Cross-component contract for request duration: HttpSuccessLoggerInterceptor
// (which sees request entry but not exception flow) marks the start, and
// HttpExceptionLoggerFilter (which sees exception flow but not entry) reads
// the elapsed time. Storing the timestamp via WeakMap keeps it off the
// express.Request object — no global type augmentation, no risk of
// colliding with another middleware that reuses the same field name.
const startTimestamps = new WeakMap<Request, number>()

export function markRequestStart(request: Request): void {
    startTimestamps.set(request, Date.now())
}

export function elapsedSinceRequestStart(request: Request): number {
    const start = startTimestamps.get(request)
    return start === undefined ? 0 : Date.now() - start
}
