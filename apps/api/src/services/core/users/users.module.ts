import { AppLoggerService, JwtAuthModule, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import {
    AppConfigService,
    getProjectId,
    MONGO_CONNECTION_NAME,
    REDIS_CONNECTION_NAME
} from 'config'
import { SecurityEventLogger, UserAuthenticationService } from './internal'
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
                onEvent: new SecurityEventLogger(logger).handle
            })
        })
    ],
    providers: [UsersService, UserAuthenticationService, UsersRepository]
})
export class UsersModule {}
