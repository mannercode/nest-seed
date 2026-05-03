import { getTemporalClientToken, TemporalClientModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService } from '../app-config.service'

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
            TemporalConfigModule.clientName
        )
    ]
})
export class TemporalConfigModule {
    static get clientName() {
        return 'temporal-client'
    }

    static get clientToken() {
        return getTemporalClientToken(this.clientName)
    }
}
