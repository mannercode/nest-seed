/* istanbul ignore file */
import { Logger } from '@nestjs/common'
import { isEqual } from './utils'

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
        const aLen = Array.isArray(a) ? a.length : undefined
        const bLen = Array.isArray(b) ? b.length : undefined

        if (aLen === undefined || bLen === undefined || aLen !== bLen) {
            throw new Error(`${message} first: ${aLen}, second: ${bLen}`)
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
        const aLen = Array.isArray(a) ? a.length : undefined
        const bLen = Array.isArray(b) ? b.length : undefined

        if (aLen === undefined || bLen === undefined || aLen !== bLen) {
            Logger.warn(`${message} first: ${aLen}, second: ${bLen}`)
        }
    }
}

export function ensure<T>(value: null | T | undefined, message = 'Value must exist.'): T {
    if (value == null) {
        throw new Error(message)
    }

    return value
}
