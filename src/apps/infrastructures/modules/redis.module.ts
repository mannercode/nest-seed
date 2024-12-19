import { Module } from '@nestjs/common'
import { RedisModule as OrgRedisModule } from 'common'
import { InfrastructuresConfigService, RedisConfig } from '../config'

@Module({
    imports: [
        OrgRedisModule.forRootAsync(
            {
                useFactory: (config: InfrastructuresConfigService) => config.redis,
                inject: [InfrastructuresConfigService]
            },
            RedisConfig.connName
        )
    ]
})
export class RedisModule {}
