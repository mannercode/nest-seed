import { BullModule } from '@nestjs/bull'
import { Global, Module } from '@nestjs/common'
import { AppConfigService } from 'config'

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            useFactory: async (config: AppConfigService) => {
                return {
                    prefix: (global as any).JEST_UNIQUE_ID ?? 'queue',
                    redis: { ...config.redis }
                }
            },
            inject: [AppConfigService]
        })
    ]
})
export class QueueModule {}
