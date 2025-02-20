import {
    getRedisConnectionToken,
    RedisModule as NestRedisModule,
    RedisModuleOptions
} from '@nestjs-modules/ioredis'
import {
    DynamicModule,
    Injectable,
    Module,
    OnApplicationBootstrap,
    OnApplicationShutdown,
    OnModuleInit
} from '@nestjs/common'
import Redis from 'ioredis'
import { sleep } from '../utils'

@Injectable()
class RedisShutdownService implements OnModuleInit, OnApplicationShutdown, OnApplicationBootstrap {
    constructor(private readonly redis: Redis) {}

    /*
    enableOfflineQueue: false로 하면 redis를 사용하는 각 서비스에서 redis가 ready 상태가 될 때까지 기다려야 한다.
    대신, 여기서 ready 상태를 기다리고 다른 서비스에서는 생략한다.
    여기서 ready가 되더라도 다른 서비스는 ready가 되는데 약간의 시간이 필요한 것 같다.
    그래서 50ms 만큼 추가 여유를 둔다.
    */
    async onApplicationBootstrap() {}

    async onModuleInit() {
        await new Promise<void>(async (resolve, reject) => {
            const maxAttempts = 500
            const retryDelay = 10

            for (let i = 0; i < maxAttempts; i++) {
                if (this.redis.status === 'ready') {
                    await sleep(50)
                    resolve()
                    return
                } else {
                    await sleep(retryDelay)
                }
            }

            reject(new Error(`Redis connection timed out after ${maxAttempts * retryDelay}ms`))
        })
    }

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
