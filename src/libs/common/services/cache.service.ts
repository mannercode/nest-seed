import { getRedisConnectionToken, RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis'
import { DynamicModule, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class CacheService implements OnModuleDestroy {
    constructor(
        private readonly redis: Redis,
        public readonly prefix: string
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
        const value = await this.redis.get(this.makeKey(key))
        return value
    }

    async delete(key: string) {
        await this.redis.del(this.makeKey(key))
    }

    async executeScript(script: string, keys: string[], args: string[]): Promise<any> {
        const result = await this.redis.eval(
            script,
            keys.length,
            ...keys.map(this.makeKey.bind(this)),
            ...args
        )
        return result
    }
}

export interface CacheNodeType {
    host: string
    port: number
}

export interface CacheModuleOptions {
    type: 'cluster' | 'single'
    nodes: CacheNodeType[]
    prefix: string
    password?: string
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
                            const { type, nodes, password } = await options.useFactory(...args)

                            let redisOptions: RedisModuleOptions = {
                                type: 'cluster',
                                nodes,
                                options: { redisOptions: { password } }
                            }

                            /* istanbul ignore if */
                            if (type === 'single') {
                                const { host, port } = nodes[0]

                                redisOptions = {
                                    type: 'single',
                                    url: `redis://${host}:${port}`,
                                    options: { password }
                                }
                            }

                            return redisOptions
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
