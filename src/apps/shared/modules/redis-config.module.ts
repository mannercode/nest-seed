import { getRedisConnectionToken, RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { AppConfigService } from '../config'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => {
                    const { nodes, password } = config.redis
                    const redisOptions: RedisModuleOptions = {
                        type: 'cluster',
                        nodes,
                        options: { redisOptions: { password } }
                    }
                    return redisOptions
                },
                inject: [AppConfigService]
            },
            RedisConfigModule.connectionName
        )
    ]
})
export class RedisConfigModule {
    static get moduleName() {
        return getRedisConnectionToken(this.connectionName)
    }

    static get connectionName() {
        return 'redis-connection'
    }
}
