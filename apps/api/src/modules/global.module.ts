import { AppLoggerService, createWinstonLogger, JwtVerifierModule } from '@mannercode/common'
import { Global, Module } from '@nestjs/common'
import { ScheduleModule } from '@nestjs/schedule'
import { hostname } from 'node:os'
import { AppConfigService } from '#config'

@Global()
@Module({
    exports: [AppLoggerService, JwtVerifierModule],
    // 비밀키와 만료 시간은 토큰 종류별로 서명·검증 시점에 넘긴다.
    imports: [ScheduleModule.forRoot(), JwtVerifierModule],
    providers: [
        {
            inject: [AppConfigService],
            provide: AppLoggerService,
            useFactory: async ({ log }: AppConfigService) => {
                const logger = createWinstonLogger({ ...log, serviceNodeName: hostname() })
                return new AppLoggerService(logger)
            }
        }
    ]
})
export class GlobalModule {}
