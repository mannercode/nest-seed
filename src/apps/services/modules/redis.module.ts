import { Module } from '@nestjs/common'
import { RedisModule as OrgRedisModule } from 'common'
import { AppConfigService, RedisConfig } from 'config'

@Module({
    imports: [
        OrgRedisModule.forRootAsync(
            { useFactory: (config: AppConfigService) => config.redis, inject: [AppConfigService] },
            RedisConfig.connName
        )
    ]
})
export class RedisModule {}
