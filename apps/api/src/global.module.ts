import { AppLoggerService, createWinstonLogger } from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from 'config'

/**
 * AppConfigService 외 어디서나 주입 가능한 공용 제공자를 모은다.
 * (AppConfigService 와 *-config 모듈은 AppConfigModule 자체가 @Global 이라
 * 별도로 노출할 필요 없음.)
 *
 * - ScheduleModule: AssetsService 의 @Cron 데코레이터를 위해 SchedulerRegistry 가
 *   모듈 그래프에 있어야 한다.
 * - JwtModule: gateway/guards 가 JwtService 를 주입한다. 빈 register({}) 는 토큰만
 *   노출하고 실제 secret/ttl 은 JwtAuthModule(UsersModule) 이 채운다.
 * - AppLoggerService: 로깅 단일 진입점.
 */
@Global()
@Module({
    exports: [AppLoggerService, JwtModule],
    imports: [ScheduleModule.forRoot(), JwtModule.register({})],
    providers: [
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
