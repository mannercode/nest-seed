import { AppLoggerService, createWinstonLogger } from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ScheduleModule } from '@nestjs/schedule'
import { AppConfigService } from 'config'

@Global()
@Module({
    exports: [AppLoggerService, JwtModule],
    // 비밀키와 만료 시간은 토큰 종류별로 서명·검증 시점에 넘긴다.
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
