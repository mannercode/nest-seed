import {
    getRedisConnectionToken,
    RedisModule as NestRedisModule,
    RedisModuleOptions
} from '@nestjs-modules/ioredis'
import { DynamicModule, Injectable, Module, OnApplicationShutdown } from '@nestjs/common'
import Redis from 'ioredis'

@Injectable()
class RedisShutdownService implements OnApplicationShutdown {
    constructor(private readonly redis: Redis) {}

    async onApplicationShutdown(signal?: string) {
        await this.redis.quit()
    }
}

export interface RedisNode {
    host: string
    port: number
}

export interface RedisOptions {
    type: 'cluster' | 'single'
    nodes: RedisNode[]
    password?: string
}

@Module({})
export class RedisModule {
    static getConnectionToken(name: string) {
        return getRedisConnectionToken(name)
    }

    static forRootAsync(
        options: {
            useFactory: (...args: any[]) => Promise<RedisOptions> | RedisOptions
            inject?: any[]
        },
        name: string
    ): DynamicModule {
        return {
            module: RedisModule,
            imports: [
                NestRedisModule.forRootAsync(
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
                    provide: RedisShutdownService,
                    useFactory: (redis: Redis) => new RedisShutdownService(redis),
                    inject: [RedisModule.getConnectionToken(name)]
                }
            ],
            exports: [NestRedisModule]
        }
    }
}
