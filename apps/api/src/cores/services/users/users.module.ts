import { JwtAuthModule, TimeUtil } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, getProjectId, MongooseConfigModule, RedisConfigModule } from 'config'
import { User, UserSchema } from './models'
import { UserAuthenticationService } from './services'
import { UsersRepository } from './users.repository'
import { UsersService } from './users.service'

@Module({
    exports: [UsersService],
    imports: [
        MongooseModule.forFeature(
            [{ name: User.name, schema: UserSchema }],
            MongooseConfigModule.connectionName
        ),
        JwtAuthModule.register({
            inject: [AppConfigService],
            prefix: `jwtauth:${getProjectId()}`,
            redisName: RedisConfigModule.connectionName,
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
