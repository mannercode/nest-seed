import { AppLoggerService, createWinstonLogger } from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from 'config'

/**
 * 어디서나 주입할 수 있는 공용 제공자를 모은다. `AppConfigService`와
 * `*-setup` 모듈은 `AppConfigModule`이 이미 `@Global`이라 여기 다시 넣지 않는다.
 *
 * - `ScheduleModule`: `@Cron`을 쓰는 서비스가 의존하는 `SchedulerRegistry`를
 *   모듈 그래프에 등록한다.
 * - `JwtModule`: 가드들이 `JwtService`를 주입받기 위해 토큰만 먼저 등록한다.
 *   실제 비밀키와 만료 시간은 `UsersModule` 안의 인증 모듈이 채운다.
 * - `AppLoggerService`: 로거 진입점.
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
