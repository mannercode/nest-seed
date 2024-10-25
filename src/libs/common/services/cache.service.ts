import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Inject, Injectable } from '@nestjs/common'
import { Cache } from 'cache-manager'
import { Exception } from 'common'

export const CACHE_TAG = 'CACHE_TAG'

@Injectable()
export class CacheService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        @Inject(CACHE_TAG) private tag: string
    ) {}

    async set(key: string, value: unknown, expireMillisecs = 0): Promise<void> {
        if (expireMillisecs < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        await this.cacheManager.set(this.tag + ':' + key, value, expireMillisecs)
    }

    async get<T>(key: string): Promise<T | undefined> {
        return this.cacheManager.get(this.tag + ':' + key)
    }

    async delete(key: string): Promise<void> {
        return this.cacheManager.del(this.tag + ':' + key)
    }
}
