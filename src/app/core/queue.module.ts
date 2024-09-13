import { BullModule } from '@nestjs/bull'
import { Global, Module } from '@nestjs/common'
import { Config } from 'config'

@Global()
@Module({
    imports: [
        BullModule.forRootAsync({
            useFactory: async () => {
                return {
                    prefix: (global as any).JEST_UNIQUE_ID ?? 'queue',
                    redis: { ...Config.redis }
                }
            }
        })
    ]
})
export class QueueModule {}
