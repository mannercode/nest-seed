import { Logger } from '@nestjs/common'

export function createServiceLogger(className: string) {
    return {
        info: (method: string, data?: object) =>
            Logger.log(`${className}.${method}`, { contextType: 'service', ...data }),
        warn: (method: string, data?: object) =>
            Logger.warn(`${className}.${method}`, { contextType: 'service', ...data }),
        error: (method: string, data?: object) =>
            Logger.error(`${className}.${method}`, { contextType: 'service', ...data })
    }
}

export abstract class BaseService {
    protected readonly log = createServiceLogger(this.constructor.name)
}
