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

    // onModuleDestroy에서 quit()를 하면 bullmq와 같이 redis를 사용하는 다른 모듈에서 에러가 발생한다.
    async onApplicationShutdown() {
        await this.redis.quit()
    }
}

export interface RedisNode {
    host: string
    port: number
}

export interface RedisOptions {
    nodes: RedisNode[]
    password?: string
}

@Module({})
export class RedisModule {
    static getToken(name: string) {
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
                            const { nodes, password } = await options.useFactory(...args)

                            let redisOptions: RedisModuleOptions = {
                                type: 'cluster',
                                nodes,
                                options: { redisOptions: { password }, enableOfflineQueue: true }
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
                    provide: `RedisShutdownService-${name}`,
                    useFactory: async (redis: Redis) => {
                        return new RedisShutdownService(redis)
                    },
                    inject: [RedisModule.getToken(name)]
                }
            ],
            exports: [NestRedisModule]
        }
    }
}
