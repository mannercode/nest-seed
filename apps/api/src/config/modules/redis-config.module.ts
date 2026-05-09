import { RedisModuleOptions, getRedisConnectionToken, RedisModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService } from '../app-config.service'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => {
                    const { nodes } = config.redis
                    const redisOptions: RedisModuleOptions = {
                        nodes,
                        options: {
                            // ioredis 기본값은 16; stress burst 가 여러 slot 을 연달아
                            // 때리면 local slot cache 가 안정되기 전에 budget 이
                            // 소진될 수 있다.
                            maxRedirections: 32,
                            retryDelayOnFailover: 200,
                            retryDelayOnClusterDown: 200,
                            slotsRefreshTimeout: 5000,
                            // node 별 TCP 옵션. 기본 keepAlive=0 이면 idle socket 이
                            // NAT/firewall timeout 으로 조용히 죽고, 죽은 socket 을
                            // 재사용하다가 burst 중에 "Connection is closed" 로 터진다.
                            redisOptions: {
                                keepAlive: 30_000,
                                connectTimeout: 10_000,
                                maxRetriesPerRequest: null
                            }
                        },
                        type: 'cluster'
                    }
                    return redisOptions
                }
            },
            RedisConfigModule.connectionName
        )
    ]
})
export class RedisConfigModule {
    static get connectionName() {
        return 'redis-connection'
    }

    static get moduleName() {
        return getRedisConnectionToken(this.connectionName)
    }
}
