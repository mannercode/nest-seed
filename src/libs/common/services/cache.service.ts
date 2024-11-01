import { InjectRedis, RedisModule } from '@nestjs-modules/ioredis'
import { DynamicModule, Inject, Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { Exception } from 'common'
import Redis from 'ioredis'

@Injectable()
export class CacheService {
    constructor(
        @InjectRedis() private readonly redis: Redis,
        @Inject('PREFIX') private prefix?: string
    ) {}

    private makeKey(key: string) {
        return this.prefix ? `${this.prefix}:${key}` : key
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

@Injectable()
class CacheConnectionService implements OnModuleDestroy {
    constructor(@InjectRedis() private readonly redis: Redis) {}

    async onModuleDestroy() {
        await this.redis.quit()
    }
}

export interface CacheModuleOptions {
    prefix?: string
    host: string
    port: number
}

@Module({})
export class CacheModule {
    static forRootAsync(options: {
        useFactory: (...args: any[]) => CacheModuleOptions
        inject?: any[]
    }): DynamicModule {
        return {
            module: CacheModule,
            imports: [
                RedisModule.forRootAsync({
                    useFactory: async (...args: any[]) => {
                        const { host, port } = options.useFactory(...args)

                        return { type: 'single', url: `redis://${host}:${port}` }
                    },
                    inject: options.inject
                })
            ],
            providers: [
                CacheService,
                CacheConnectionService,
                {
                    provide: 'PREFIX',
                    useFactory: async (...args: any[]) => {
                        const cacheOptions = options.useFactory(...args)
                        return cacheOptions.prefix
                    },
                    inject: options.inject
                }
            ],
            exports: [CacheService]
        }
    }
}
