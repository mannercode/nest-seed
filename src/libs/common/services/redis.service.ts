import { getRedisConnectionToken, RedisModule } from '@nestjs-modules/ioredis'
import { DynamicModule, Inject, Injectable, Module } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class RedisService {
    constructor(
        private readonly redis: Redis,
        @Inject('PREFIX') private prefix: string
    ) {
        console.log('this.prefix', this.prefix)
    }

    async onModuleDestroy() {
        await this.redis.quit()
    }

    private makeKey(key: string) {
        return `${this.prefix}:${key}`
    }

    async set(key: string, value: string, milliseconds = 0) {
        if (milliseconds < 0) {
            throw new Exception('ttlMiliseconds should not be negative')
        }

        if (0 < milliseconds) {
            await this.redis.set(this.makeKey(key), value, 'PX', milliseconds)
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
    host: string
    port: number
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
        const redisServiceProvider = {
            provide: RedisService,
            useFactory: (redis: Redis, prefix: string) => {
                return new RedisService(redis, prefix)
            },
            inject: [getRedisConnectionToken(name), 'PREFIX']
        }

        return {
            module: CacheModule,
            imports: [
                RedisModule.forRootAsync(
                    {
                        useFactory: async (...args: any[]) => {
                            const { host, port } = await options.useFactory(...args)

                            return { type: 'single', url: `redis://${host}:${port}` }
                        },
                        inject: options.inject
                    },
                    name
                )
            ],
            providers: [
                {
                    provide: 'PREFIX',
                    useFactory: async (...args: any[]) => {
                        const { prefix } = await options.useFactory(...args)
                        return prefix
                    },
                    inject: options.inject || []
                },
                redisServiceProvider
            ],
            exports: [redisServiceProvider]
        }
    }
}
