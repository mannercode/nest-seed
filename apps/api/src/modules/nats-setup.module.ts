import { NatsModule } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, NATS_CONNECTION_NAME } from 'config'

@Module({
    imports: [
        NatsModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => ({ servers: config.nats.servers })
            },
            NATS_CONNECTION_NAME
        )
    ]
})
export class NatsSetupModule {}
