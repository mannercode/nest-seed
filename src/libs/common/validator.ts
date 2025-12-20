/* istanbul ignore file */
import { isEqual } from 'lodash'
import { Logger } from '@nestjs/common'

export function orDefault<T>(value: T | null | undefined, defaultValue: T): T {
    return value ?? defaultValue
}

export class Assert {
    static equalLength(a: any[] | undefined, b: any[] | undefined, message: string) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            throw new Error(
                `${message} first: ${a ? a.length : undefined}, second: ${b ? b.length : undefined}`
            )
        }
    }

    static equals<T>(a: T, b: T, message: string) {
        if (!isEqual(a, b)) {
            throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}, ${message}`)
        }
    }

    static defined<T>(
        value: T | null | undefined,
        message = 'Value must exist.'
    ): asserts value is NonNullable<T> {
        if (value == null) {
            throw new Error(message)
        }
    }
}

export class Expect {
    static equalLength(a: any[] | undefined, b: any[] | undefined, message: string) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            Logger.warn(
                `${message} first: ${a ? a.length : undefined}, second: ${b ? b.length : undefined}`
            )
        }
    }
}
