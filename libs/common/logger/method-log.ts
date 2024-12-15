import { Logger, LogLevel } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import 'reflect-metadata'

export interface MethodLogOptions {
    level?: LogLevel
    excludeArgs?: string[]
}

const getParameterNames = (func: (...args: any[]) => any) => {
    const STRIP_COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/gm
    const ARGUMENT_NAMES = /([^\s,]+)/g
    const fnStr = func.toString().replace(STRIP_COMMENTS, '')
    const result = fnStr.slice(fnStr.indexOf('(') + 1, fnStr.indexOf(')')).match(ARGUMENT_NAMES)
    return result || []
}

export function MethodLog(options: MethodLogOptions = {}): MethodDecorator {
    const { level = 'log', excludeArgs = [] } = options

    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value
        const className = target.constructor.name
        const logger = new Logger(className)

        descriptor.value = async function (...args: any[]) {
            const paramNames = getParameterNames(originalMethod)
            const filteredArgs = args.filter((_, index) => !excludeArgs.includes(paramNames[index]))

            const start = Date.now()

            try {
                const result = await originalMethod.apply(this, args)

                logger[level](`${className}.${propertyKey}`, {
                    args: filteredArgs,
                    return: result,
                    duration: Date.now() - start
                })
                return result
            } catch (error) {
                logger.error(`${className}.${propertyKey}`, {
                    args: filteredArgs,
                    error: error.message,
                    duration: Date.now() - start
                })
                throw error
            }
        }
    }
}

export function MethodLogOnEvent(
    eventName: string,
    logOptions?: MethodLogOptions
): MethodDecorator {
    return (target, propertyKey, descriptor) => {
        /* 순서가 중요함 methodLog 적용 후 onEvent 적용해야 한다 */

        const methodLogDecorator = MethodLog(logOptions)
        methodLogDecorator(target, propertyKey, descriptor)

        const onEventDecorator = OnEvent(eventName)
        onEventDecorator(target, propertyKey, descriptor)

        return descriptor
    }
}
