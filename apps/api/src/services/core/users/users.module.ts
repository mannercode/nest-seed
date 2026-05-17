import { AppLoggerService, JwtAuthModule, SecurityEvent, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
    AppConfigService,
    getProjectId,
    MONGO_CONNECTION_NAME,
    REDIS_CONNECTION_NAME
} from 'config'
import { UserAuthenticationService } from './internal'
import { User, UserSchema } from './models'
import { UsersRepository } from './users.repository'
import { UsersService } from './users.service'

@Module({
    exports: [UsersService],
    imports: [
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }], MONGO_CONNECTION_NAME),
        JwtAuthModule.register({
            inject: [AppConfigService, AppLoggerService],
            prefix: `jwtauth:${getProjectId()}`,
            redisName: REDIS_CONNECTION_NAME,
            useFactory: ({ auth }: AppConfigService, logger: AppLoggerService) => ({
                auth: {
                    accessSecret: auth.accessSecret,
                    accessTokenTtlMs: TimeUtil.toMs(auth.accessTokenExpiration),
                    audience: auth.audience,
                    issuer: auth.issuer,
                    refreshSecret: auth.refreshSecret,
                    refreshTokenTtlMs: TimeUtil.toMs(auth.refreshTokenExpiration)
                },
                // 영구 감사 로그(저장소, 보관 기간, 민감 정보 마스킹)는 별도
                // 결정이 필요하다. 그 결정을 미루는 동안에도 보안 이벤트가
                // 사라지지 않도록 일단 애플리케이션 로거에 남긴다.
                onEvent: (event: SecurityEvent) => {
                    const message = `security_event:${event.type}`
                    if (event.type === 'token.reuse_detected') logger.error(message, event)
                    else if (event.type === 'verify.failed') logger.warn(message, event)
                    else logger.log(message, event)
                }
            })
        })
    ],
    providers: [UsersService, UserAuthenticationService, UsersRepository]
})
export class UsersModule {}
