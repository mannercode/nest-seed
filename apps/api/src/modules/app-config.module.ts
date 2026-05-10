import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { AppConfigService } from 'config'
import { MongooseSetupModule } from './mongoose-setup.module'
import { NatsSetupModule } from './nats-setup.module'
import { RedisSetupModule } from './redis-setup.module'
import { TemporalSetupModule } from './temporal-setup.module'

/**
 * config 의 모든 책임을 한 모듈로 노출한다.
 *
 * - ConfigModule.forRoot: 환경 변수 검증 (Joi 스키마는 AppConfigService.schema).
 * - AppConfigService: 검증된 환경 값을 DI 로 노출하는 진입점.
 * - 4 개 외부 자원 연결 모듈 (Mongoose / Redis / NATS / Temporal): 부트 시점에
 *   외부 자원과 연결을 만들고 DI 토큰으로 노출.
 *
 * @Global 이라 AppModule 이 한 번만 import 하면 AppConfigService 와 4 개의
 * *-setup 모듈 토큰이 어디서나 inject 가능해진다.
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
