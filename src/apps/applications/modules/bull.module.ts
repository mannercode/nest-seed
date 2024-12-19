import { Module } from '@nestjs/common'
import { generateShortId, BullModule as OrgBullModule } from 'common'
import { isTest, RedisConfig } from '../config'

@Module({
    imports: [
        OrgBullModule.forRootAsync({
            name: 'queue',
            redisName: RedisConfig.connName,
            useFactory: () => ({ prefix: isTest() ? `{queue:${generateShortId()}}` : '{queue}' })
        })
    ]
})
export class BullModule {}
