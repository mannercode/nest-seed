import { RedisModuleOptions } from '@mannercode/nest-common'
import { getRedisConnectionToken, RedisModule } from '@mannercode/nest-common'
import { Module } from '@nestjs/common'
import { AppConfigService } from '../config'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => {
                    const { nodes } = config.redis
                    const redisOptions: RedisModuleOptions = { nodes, type: 'cluster' }
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
