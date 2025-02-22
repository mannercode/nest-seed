/* istanbul ignore file */

import { isEqual } from 'lodash'
import { LogicException } from './exceptions'
import { Logger } from '@nestjs/common'

type FailureHandler = (message: string) => void

class Validator {
    constructor(private handler: FailureHandler) {}

    equalLength(a: any[], b: any[], message: string) {
        if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
            this.handler(`${message} first: ${a.length}, second: ${b.length}`)
        }
    }

    equals<T>(a: T, b: T, message: string) {
        if (!isEqual(a, b)) {
            this.handler(`${JSON.stringify(a)} !== ${JSON.stringify(b)}, ${message}`)
        }
    }

    defined(value: any, message: string) {
        if (!value) {
            this.handler(message)
        }
    }

    undefined(value: any, message: string) {
        if (value !== undefined) {
            this.handler(message)
        }
    }

    notDefined(value: any, message: string) {
        if (value) {
            this.handler(message)
        }
    }

    truthy(value: any, message: string) {
        if (!value) {
            this.handler(message)
        }
    }

    falsy(value: any, message: string) {
        if (value) {
            this.handler(message)
        }
    }

    unique(value: any, message: string) {
        if (1 < value.length) {
            this.handler(message)
        }
    }
}

export const Assert = new Validator((message) => {
    throw new LogicException(message)
})

export const Expect = new Validator((message) => {
    Logger.warn(message)
})
