import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigService } from 'config'
import { MongooseSetupModule } from './mongoose-setup.module'
import { NatsSetupModule } from './nats-setup.module'
import { RedisSetupModule } from './redis-setup.module'
import { TemporalSetupModule } from './temporal-setup.module'

@Global()
@Module({
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationOptions: { abortEarly: false },
            validationSchema: AppConfigService.schema
        }),
        MongooseSetupModule,
        RedisSetupModule,
        NatsSetupModule,
        TemporalSetupModule
    ],
    providers: [AppConfigService],
    exports: [
        AppConfigService,
        MongooseSetupModule,
        RedisSetupModule,
        NatsSetupModule,
        TemporalSetupModule
    ]
})
export class AppConfigModule {}
