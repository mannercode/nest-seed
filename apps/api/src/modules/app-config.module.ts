import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigService } from 'config'
import { MongooseSetupModule } from './mongoose-setup.module'
import { NatsSetupModule } from './nats-setup.module'
import { RedisSetupModule } from './redis-setup.module'
import { TemporalSetupModule } from './temporal-setup.module'

/**
 * 설정 관련 책임을 한 모듈로 묶습니다. `@Global` 모듈이라 `AppModule`이 한 번만
 * 가져오면 `AppConfigService`와 외부 자원 setup 모듈의 토큰을 어디서나 주입할 수 있습니다.
 */
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
