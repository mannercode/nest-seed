import { RedisModule, RedisModuleOptions } from '@nestjs-modules/ioredis'
import { Module } from '@nestjs/common'
import { AppConfigService, RedisConfig } from '../config'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                useFactory: (config: AppConfigService) => {
                    const { nodes, password } = config.redis
                    const redisOptions: RedisModuleOptions = {
                        type: 'cluster',
                        nodes,
                        options: {
                            redisOptions: { password },
                            enableOfflineQueue: false
                        }
                    }
                    return redisOptions
                },
                inject: [AppConfigService]
            },
            RedisConfig.connName
        )
    ]
})
export class RedisConfigModule {}
