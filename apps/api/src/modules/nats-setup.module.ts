import { getNatsConnectionToken, NatsModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService } from 'config'

@Module({
    imports: [
        NatsModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => ({ servers: config.nats.servers })
            },
            NatsSetupModule.connectionName
        )
    ]
})
export class NatsSetupModule {
    static get connectionName() {
        return 'nats-connection'
    }

    static get moduleName() {
        return getNatsConnectionToken(this.connectionName)
    }
}
