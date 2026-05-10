import { TemporalClientModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, TEMPORAL_CLIENT_NAME } from 'config'

@Module({
    imports: [
        TemporalClientModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => ({
                    address: config.temporal.address,
                    namespace: config.temporal.namespace
                })
            },
            TEMPORAL_CLIENT_NAME
        )
    ]
})
export class TemporalSetupModule {}
