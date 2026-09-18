import { JwtAuthModule, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from '#config'
import { UserAuthenticationService } from './internal/index.js'
import { UsersRepository } from './users.repository.js'
import { UsersService } from './users.service.js'

@Module({
    exports: [UsersService],
    imports: [
        JwtAuthModule.register({
            inject: [AppConfigService],
            prefix: (config: AppConfigService) => `jwtauth:${config.projectId}`,
            redisName: REDIS_CONNECTION_NAME,
            useFactory: ({ auth }: AppConfigService) => ({
                auth: {
                    accessSecret: auth.accessSecret,
                    accessTokenTtlMs: TimeUtil.toMs(auth.accessTokenExpiration),
                    audience: auth.audience,
                    issuer: auth.issuer,
                    refreshSecret: auth.refreshSecret,
                    refreshTokenTtlMs: TimeUtil.toMs(auth.refreshTokenExpiration)
                }
            })
        })
    ],
    providers: [UsersService, UserAuthenticationService, UsersRepository]
})
export class UsersModule {}
