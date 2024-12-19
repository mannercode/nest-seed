import { Module } from '@nestjs/common'
import { RedisModule as OrgRedisModule } from 'common'
import { CoresConfigService, RedisConfig } from '../config'

@Module({
    imports: [
        OrgRedisModule.forRootAsync(
            { useFactory: (config: CoresConfigService) => config.redis, inject: [CoresConfigService] },
            RedisConfig.connName
        )
    ]
})
export class RedisModule {}
