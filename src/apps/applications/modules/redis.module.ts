import { Module } from '@nestjs/common'
import { RedisModule as OrgRedisModule } from 'common'
import { ApplicationsConfigService, RedisConfig } from '../config'

@Module({
    imports: [
        OrgRedisModule.forRootAsync(
            { useFactory: (config: ApplicationsConfigService) => config.redis, inject: [ApplicationsConfigService] },
            RedisConfig.connName
        )
    ]
})
export class RedisModule {}
