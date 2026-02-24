/* istanbul ignore file */
import { Logger } from '@nestjs/common'
import { isEqual } from 'lodash'

export class Require {
    static defined<T>(
        value: null | T | undefined,
        message = 'Value must exist.'
    ): asserts value is NonNullable<T> {
        if (value == null) {
            throw new Error(message)
        }
    }

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
}

export class Verify {
    static equalLength(a: any[] | undefined, b: any[] | undefined, message: string) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            Logger.warn(
                `${message} first: ${a ? a.length : undefined}, second: ${b ? b.length : undefined}`
            )
        }
    }
}

export function ensure<T>(value: null | T | undefined, message = 'Value must exist.'): T {
    if (value == null) {
        throw new Error(message)
    }

    return value
}
