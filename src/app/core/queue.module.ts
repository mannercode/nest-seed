import { BullModule } from '@nestjs/bull'
import { Global, Module } from '@nestjs/common'
import { generateUUID } from 'common'
import { AppConfigService, isEnv } from 'config'

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            useFactory: async (config: AppConfigService) => {
                return {
                    prefix: isEnv('test') ? 'test:' + generateUUID() : 'queue',
                    redis: config.redis
                }
            },
            inject: [AppConfigService]
        })
    ]
})
export class QueueModule {}
