import { Module } from '@nestjs/common'
import { getRedisConnectionToken, RedisModule, RedisModuleOptions } from 'common'
import { AppConfigService } from '../config'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => {
                    const { nodes } = config.redis
                    const redisOptions: RedisModuleOptions = { type: 'cluster', nodes }
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
