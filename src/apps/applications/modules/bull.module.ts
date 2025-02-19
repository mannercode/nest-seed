import { Module } from '@nestjs/common'
import { BullModule as OrgBullModule } from 'common'
import { ProjectName, RedisConfig, uniqueWhenTesting } from 'shared/config'

@Module({
    imports: [
        OrgBullModule.forRootAsync({
            name: 'queue',
            redisName: RedisConfig.connName,
            useFactory: () => ({
                prefix: `{queue:${uniqueWhenTesting(ProjectName)}}`
            })
        })
    ]
})
export class BullModule {}
