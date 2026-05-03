import { getNatsConnectionToken, NatsModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService } from '../app-config.service'

@Module({
    imports: [
        NatsModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => ({ servers: config.nats.servers })
            },
            NatsConfigModule.connectionName
        )
    ]
})
export class NatsConfigModule {
    static get connectionName() {
        return 'nats-connection'
    }

    static get moduleName() {
        return getNatsConnectionToken(this.connectionName)
    }
}
