import { getTemporalClientToken, TemporalClientModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService } from 'config'

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
            TemporalSetupModule.clientName
        )
    ]
})
export class TemporalSetupModule {
    static get clientName() {
        return 'temporal-client'
    }

    static get clientToken() {
        return getTemporalClientToken(this.clientName)
    }
}
