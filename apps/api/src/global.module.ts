import { AppLoggerService, createWinstonLogger } from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from './config'

/**
 * 어디서나 주입 가능한 공용 제공자와, 한 번만 등록되어야 하는 forRoot 호출을 모은다.
 *
 * - ConfigModule + AppConfigService: 환경 변수 검증 단일 진입점.
 * - ScheduleModule: AssetsService 의 @Cron 데코레이터를 위해 SchedulerRegistry 가
 *   모듈 그래프에 있어야 한다.
 * - JwtModule: gateway/guards 가 JwtService 를 주입한다. 빈 register({}) 는 토큰만
 *   노출하고 실제 secret/ttl 은 JwtAuthModule(UsersModule) 이 채운다.
 * - AppLoggerService: 로깅 단일 진입점.
 */
@Global()
@Module({
    exports: [AppConfigService, AppLoggerService, JwtModule],
    imports: [
        ConfigModule.forRoot({
            cache: true,
            ignoreEnvFile: true,
            validationOptions: { abortEarly: false },
            validationSchema: AppConfigService.schema
        }),
        ScheduleModule.forRoot(),
        JwtModule.register({})
    ],
    providers: [
        AppConfigService,
        {
            inject: [AppConfigService],
            provide: AppLoggerService,
            useFactory: async ({ log }: AppConfigService) => {
                const logger = createWinstonLogger(log)
                return new AppLoggerService(logger)
            }
        }
    ]
})
export class GlobalModule {}
