import type { ModuleMetadata } from '@nestjs/common'

export type CacheModuleOptions = {
    imports?: ModuleMetadata['imports']
    inject?: any[]
    name?: string
    prefix: string | ((...args: any[]) => Promise<string> | string)
    redisName?: string
}
