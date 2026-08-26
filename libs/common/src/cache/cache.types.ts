export type CacheModuleOptions = {
    inject?: any[]
    name?: string
    prefix: string | ((...args: any[]) => Promise<string> | string)
    redisName?: string
}
