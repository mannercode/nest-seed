/* istanbul ignore file */

import { Logger } from '@nestjs/common'
import { isEqual } from 'lodash'

export class Expect {
    static equalLength(a: any[], b: any[], message: string) {
        if (a.length !== b.length) {
            Logger.warn(message)
        }
    }

    static equals<T>(a: T, b: T, message: string) {
        if (!isEqual(a, b)) {
            Logger.warn(`${JSON.stringify(a)} !== ${JSON.stringify(b)}, ${message}`)
        }
    }

    static defined(value: any, message: string) {
        if (!value) {
            Logger.warn(message)
        }
    }

    static undefined(value: any, message: string) {
        if (value !== undefined) {
            Logger.warn(message)
        }
    }

    static notDefined(value: any, message: string) {
        if (value) {
            Logger.warn(message)
        }
    }

    static truthy(value: any, message: string) {
        if (!value) {
            Logger.warn(message)
        }
    }

    static falsy(value: any, message: string) {
        if (value) {
            Logger.warn(message)
        }
    }

    static unique(value: any, message: string) {
        if (1 < value.length) {
            Logger.warn(message)
        }
    }
}
