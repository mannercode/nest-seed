import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { Exception, stringToMillisecs } from 'common'

@Injectable()
export class CacheService implements OnModuleDestroy {
    constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

    onModuleDestroy() {
        const client = (this.cacheManager.store as any).client

        client?.disconnect()
    }

    async set(key: string, value: string, expireTime = '0s'): Promise<void> {
        const expireMillisecs = stringToMillisecs(expireTime)

        if (expireMillisecs < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        await this.cacheManager.set(key, value, expireMillisecs)
    }

    async get(key: string): Promise<string | undefined> {
        return this.cacheManager.get(key)
    }

    async delete(key: string): Promise<void> {
        return this.cacheManager.del(key)
    }
}
