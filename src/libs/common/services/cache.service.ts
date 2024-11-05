import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { DynamicModule, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class CacheService implements OnModuleDestroy {
    constructor(
        private readonly redis: Redis,
        private readonly prefix: string
    ) {}

    async onModuleDestroy() {
        await this.redis.quit()
    }

    private makeKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async set(key: string, value: string, ttlMs = 0) {
        if (ttlMs < 0) {
            throw new Exception('TTL must not be negative')
        }

        if (0 < ttlMs) {
            await this.redis.set(this.makeKey(key), value, 'PX', ttlMs)
        } else {
            await this.redis.set(this.makeKey(key), value)
        }
    }

    async get(key: string): Promise<string | null> {
        return this.redis.get(this.makeKey(key))
    }

    async delete(key: string) {
        await this.redis.del(this.makeKey(key))
    }
}

export interface CacheModuleOptions {
    type: 'cluster' | 'single'
    nodes: { host: string; port: number }[]
    prefix: string
}

@Module({})
export class CacheModule {
    static forRootAsync(
        options: {
            useFactory: (...args: any[]) => Promise<CacheModuleOptions> | CacheModuleOptions
            inject?: any[]
        },
        name: string
    ): DynamicModule {
        return {
            module: CacheModule,
            imports: [
                RedisModule.forRootAsync(
                    {
                        useFactory: async (...args: any[]) => {
                            const { type, nodes } = await options.useFactory(...args)

                            if (type === 'single') {
                                const { host, port } = nodes[0]
                                return { type: 'single', url: `redis://${host}:${port}` }
                            }

                            // jest에서 redis cluster를 테스트 하기 어렵다.
                            /* istanbul ignore next */
                            return { type, nodes }
                        },
                        inject: options.inject
                    },
                    name
                )
            ],
            providers: [
                {
                    provide: CacheService,
                    useFactory: (redis: Redis, prefix: string) => {
                        return new CacheService(redis, prefix)
                    },
                    inject: [getRedisConnectionToken(name), 'PREFIX']
                },
                {
                    provide: 'PREFIX',
                    useFactory: async (...args: any[]) => {
                        const { prefix } = await options.useFactory(...args)
                        return prefix
                    },
                    inject: options.inject || []
                }
            ],
            exports: [CacheService]
        }
    }
}
