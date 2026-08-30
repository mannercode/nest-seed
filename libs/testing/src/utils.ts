import inspector from 'node:inspector'

export type InstantInput = Temporal.Instant | number | string
export type PlainDateInput = Temporal.PlainDate | string

/** Legacy Date fixture for schemas and adapters whose public contract is still Date. */
export const nullDate = new Date(0)
export const nullInstant = Temporal.Instant.fromEpochMilliseconds(0)
export const nullPlainDate = Temporal.PlainDate.from('1970-01-01')
export const nullObjectId = '000000000000000000000000'
export const oid = (value: number) => value.toString(16).padStart(24, '0')

/** Creates an instant from an explicit ISO offset or epoch milliseconds. */
export function instant(value: InstantInput = 0): Temporal.Instant {
    if (value instanceof Temporal.Instant) return value
    if (typeof value === 'number') return Temporal.Instant.fromEpochMilliseconds(value)
    return Temporal.Instant.from(value)
}

/** Creates a calendar date without carrying a time zone into domain fixtures. */
export function plainDate(value: PlainDateInput): Temporal.PlainDate {
    if (value instanceof Temporal.PlainDate) return value
    if (!/^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}$/.test(value)) {
        throw new RangeError(`Expected an ISO calendar date: ${value}`)
    }
    return Temporal.PlainDate.from(value)
}
export async function step(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
        await fn()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`step "${name}" failed: ${message}`, {
            cause: error instanceof Error ? error : undefined
        })
    }
}
export const toAny = <T>(value: T) => value as any

export function withTestId(prefix: string) {
    const testId = process.env['TEST_ID']
    if (!testId) throw new Error('Environment variable TEST_ID is not defined')
    return `${prefix}-${testId}`
}

export function isDebuggingEnabled(): boolean {
    return inspector.url() !== undefined
}
