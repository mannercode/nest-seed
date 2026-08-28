import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigService, PROJECT_ID_TOKEN, readProjectId } from 'config'
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
            validationOptions: { libraryOptions: { abortEarly: false } },
            validationSchema: AppConfigService.schema
        }),
        MongooseSetupModule,
        RedisSetupModule,
        NatsSetupModule,
        TemporalSetupModule
    ],
    providers: [{ provide: PROJECT_ID_TOKEN, useFactory: readProjectId }, AppConfigService],
    exports: [
        AppConfigService,
        PROJECT_ID_TOKEN,
        MongooseSetupModule,
        RedisSetupModule,
        NatsSetupModule,
        TemporalSetupModule
    ]
})
export class AppConfigModule {}
