import { AppLoggerService, JwtAuthModule, SecurityEvent, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, MONGO_CONNECTION_NAME, REDIS_CONNECTION_NAME } from 'config'
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
            prefix: (config: AppConfigService) => `jwtauth:${config.projectId}`,
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
                // 보안 이벤트는 공통 AppLogger로 보내 로그 수집 경로에 남기고, 유형별로 심각도를 나눈다.
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
